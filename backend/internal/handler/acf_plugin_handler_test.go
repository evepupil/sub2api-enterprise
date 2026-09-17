package handler

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type acfPluginHandlerOrgLookup struct {
	summaries map[int64]*service.OrganizationSummary
}

func (s *acfPluginHandlerOrgLookup) GetSummaryByUserID(ctx context.Context, userID int64) (*service.OrganizationSummary, error) {
	return s.summaries[userID], nil
}

type acfPluginHandlerOrgRepo struct {
	orgs map[int64]*service.Organization
}

func (r *acfPluginHandlerOrgRepo) Create(ctx context.Context, organization *service.Organization) error {
	return errors.New("not implemented")
}
func (r *acfPluginHandlerOrgRepo) CreateMember(ctx context.Context, member *service.OrganizationMembership) error {
	return errors.New("not implemented")
}
func (r *acfPluginHandlerOrgRepo) GetByID(ctx context.Context, id int64) (*service.Organization, error) {
	if org, ok := r.orgs[id]; ok {
		return org, nil
	}
	return nil, service.ErrOrganizationNotFound
}
func (r *acfPluginHandlerOrgRepo) GetMembershipByUserID(ctx context.Context, userID int64) (*service.OrganizationMembership, error) {
	return nil, service.ErrOrganizationMembershipNotFound
}
func (r *acfPluginHandlerOrgRepo) ListInvitations(ctx context.Context, organizationID int64, limit int) ([]service.RedeemCode, error) {
	return nil, nil
}
func (r *acfPluginHandlerOrgRepo) DisableInvitation(ctx context.Context, organizationID int64, invitationID int64) error {
	return nil
}

// acfPluginHandlerFixture 组装带假 ACF 上游的完整处理器。
// 归属：owner(13) 是组织 12 的管理员；member(14) 是组织 12 的普通成员；
// 平台管理员账号 1 不属于任何组织，通过 org_id 参数指定组织。
type acfPluginHandlerFixture struct {
	router        *gin.Engine
	gotAssertions *[]string
}

func newACFPluginHandlerFixture(t *testing.T) *acfPluginHandlerFixture {
	t.Helper()
	gin.SetMode(gin.TestMode)

	gotAssertions := []string{}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAssertions = append(gotAssertions, r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"requests":3}`))
	}))
	t.Cleanup(upstream.Close)

	plugin, err := service.ProvideACFPluginService(
		acfPluginTestConfig(t, upstream.URL),
		&acfPluginHandlerOrgLookup{summaries: map[int64]*service.OrganizationSummary{
			13: {ID: 12, Name: "某某科技", IsOwner: true},
			14: {ID: 12, Name: "某某科技", IsOwner: false},
		}},
		&acfPluginHandlerOrgRepo{orgs: map[int64]*service.Organization{
			12: {ID: 12, Name: "某某科技"},
			20: {ID: 20, Name: "另一家"},
		}},
	)
	require.NoError(t, err)
	require.NotNil(t, plugin)

	testHandler := NewACFPluginHandler(plugin)
	router := gin.New()
	// 测试认证中间件：按请求头注入会话身份（模拟 jwtAuth 之后的上下文状态）。
	router.Use(func(c *gin.Context) {
		if raw := c.GetHeader("X-Test-User"); raw != "" {
			userID, parseErr := strconv.ParseInt(raw, 10, 64)
			require.NoError(t, parseErr)
			c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: userID})
			c.Set(string(middleware.ContextKeyUserRole), c.GetHeader("X-Test-Role"))
		}
		c.Next()
	})
	v1 := router.Group("/api/v1")
	v1.GET("/acf-plugin/summary", testHandler.Summary)
	v1.GET("/acf-plugin/trend", testHandler.Trend)
	v1.GET("/acf-plugin/risk-types", testHandler.RiskTypes)
	v1.GET("/acf-plugin/top-actors", testHandler.TopActors)
	v1.GET("/acf-plugin/recent-events", testHandler.RecentEvents)

	return &acfPluginHandlerFixture{router: router, gotAssertions: &gotAssertions}
}

func acfPluginTestConfig(t *testing.T, baseURL string) *config.Config {
	t.Helper()
	_, private, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)
	der, err := x509.MarshalPKCS8PrivateKey(private)
	require.NoError(t, err)
	privateKeyPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
	return &config.Config{ACF: config.ACFConfig{Plugin: config.ACFPluginConfig{
		BaseURL:    baseURL,
		PrivateKey: privateKeyPEM,
		Issuer:     "sub2api",
		Audience:   "acf-plugin",
	}}}
}

func (f *acfPluginHandlerFixture) get(path, userID, role, query string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path+query, nil)
	if userID != "" {
		req.Header.Set("X-Test-User", userID)
		req.Header.Set("X-Test-Role", role)
	}
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec
}

func TestACFPluginHandlerDisabledWhenNotConfigured(t *testing.T) {
	gin.SetMode(gin.TestMode)
	testHandler := NewACFPluginHandler(nil)
	router := gin.New()
	v1 := router.Group("/api/v1")
	v1.GET("/acf-plugin/summary", testHandler.Summary)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/acf-plugin/summary", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusNotFound, rec.Code)
	require.JSONEq(t, `{"error":{"code":"feature_disabled"}}`, rec.Body.String())
}

func TestACFPluginHandlerUnauthenticated(t *testing.T) {
	f := newACFPluginHandlerFixture(t)
	rec := f.get("/api/v1/acf-plugin/summary", "", "", "")
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestACFPluginHandlerOrgOwnerSeesOwnOrg(t *testing.T) {
	f := newACFPluginHandlerFixture(t)
	rec := f.get("/api/v1/acf-plugin/summary", "13", "user", "")
	require.Equal(t, http.StatusOK, rec.Code)
	require.Contains(t, rec.Body.String(), `"requests":3`)
	require.Len(t, *f.gotAssertions, 1)
	require.True(t, len((*f.gotAssertions)[0]) > len("Bearer "), "必须携带断言")
}

func TestACFPluginHandlerNonOwnerForbidden(t *testing.T) {
	f := newACFPluginHandlerFixture(t)

	// 普通成员：不是组织管理员。
	rec := f.get("/api/v1/acf-plugin/summary", "14", "user", "")
	require.Equal(t, http.StatusForbidden, rec.Code)

	// 无组织用户。
	rec = f.get("/api/v1/acf-plugin/summary", "99", "user", "")
	require.Equal(t, http.StatusForbidden, rec.Code)

	require.Empty(t, *f.gotAssertions, "被拒绝的请求绝不能打到 ACF")
}

func TestACFPluginHandlerOwnerCannotPassForeignOrg(t *testing.T) {
	f := newACFPluginHandlerFixture(t)
	foreign := int64(20)
	rec := f.get("/api/v1/acf-plugin/summary", "13", "user", "?org_id="+strconv.FormatInt(foreign, 10))
	require.Equal(t, http.StatusForbidden, rec.Code)
}

func TestACFPluginHandlerPlatformAdminViewsAnyOrg(t *testing.T) {
	f := newACFPluginHandlerFixture(t)

	rec := f.get("/api/v1/acf-plugin/summary", "1", "admin", "")
	// 平台管理员必须显式指定组织。
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.JSONEq(t, `{"error":{"code":"org_id_required"}}`, rec.Body.String())

	rec = f.get("/api/v1/acf-plugin/summary", "1", "admin", "?org_id=20")
	require.Equal(t, http.StatusOK, rec.Code)
	require.Len(t, *f.gotAssertions, 1)

	// 不存在的组织。
	rec = f.get("/api/v1/acf-plugin/summary", "1", "admin", "?org_id=404")
	require.Equal(t, http.StatusNotFound, rec.Code)
	require.JSONEq(t, `{"error":{"code":"org_not_found"}}`, rec.Body.String())
}

func TestACFPluginHandlerInvalidWindow(t *testing.T) {
	f := newACFPluginHandlerFixture(t)

	// 起止倒置。
	rec := f.get("/api/v1/acf-plugin/summary", "13", "user",
		"?from=2026-09-02T00:00:00Z&to=2026-09-01T00:00:00Z")
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.JSONEq(t, `{"error":{"code":"invalid_window"}}`, rec.Body.String())

	// 跨度超过 90 天。
	rec = f.get("/api/v1/acf-plugin/summary", "13", "user",
		"?from=2026-01-01T00:00:00Z&to=2026-09-01T00:00:00Z")
	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestACFPluginHandlerUpstreamUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// 指向一个必然拒绝连接的地址，代理应返回 502。
	plugin, err := service.ProvideACFPluginService(
		acfPluginTestConfig(t, "http://127.0.0.1:1"),
		&acfPluginHandlerOrgLookup{summaries: map[int64]*service.OrganizationSummary{
			13: {ID: 12, Name: "某某科技", IsOwner: true},
		}},
		&acfPluginHandlerOrgRepo{},
	)
	require.NoError(t, err)
	testHandler := NewACFPluginHandler(plugin)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if raw := c.GetHeader("X-Test-User"); raw != "" {
			userID, parseErr := strconv.ParseInt(raw, 10, 64)
			require.NoError(t, parseErr)
			c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: userID})
			c.Set(string(middleware.ContextKeyUserRole), c.GetHeader("X-Test-Role"))
		}
		c.Next()
	})
	v1 := router.Group("/api/v1")
	v1.GET("/acf-plugin/summary", testHandler.Summary)

	rec := (&acfPluginHandlerFixture{router: router}).get("/api/v1/acf-plugin/summary", "13", "user", "")
	require.Equal(t, http.StatusBadGateway, rec.Code)
	require.JSONEq(t, `{"error":{"code":"acf_unavailable"}}`, rec.Body.String())
}
