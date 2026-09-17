package service

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"

	"github.com/Wei-Shaw/sub2api/internal/config"
)

// verifyACFPluginAssertion 按 ACF 侧 plugin_assert.go 的验证规则解析断言：
// 只认 EdDSA、校验 iss/aud、exp 必填、±1 分钟容忍。它是契约的可执行镜像，
// 用于钉死「我们签的断言 ACF 一定能验」。
func verifyACFPluginAssertion(t *testing.T, key *ACFPluginKeyPair, issuer, audience, tokenString string) (sub, org string) {
	t.Helper()
	publicDER, err := x509.MarshalPKIXPublicKey(key.Public)
	require.NoError(t, err)
	publicPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicDER})
	parsed, err := x509.ParsePKIXPublicKey(publicDER)
	require.NoError(t, err)
	require.IsType(t, ed25519.PublicKey{}, parsed, "PEM PKIX 导出的公钥必须还原为 Ed25519")
	_ = publicPEM

	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{"EdDSA"}),
		jwt.WithIssuer(issuer),
		jwt.WithAudience(audience),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(time.Minute),
	)
	var claims struct {
		jwt.RegisteredClaims
		Org string `json:"org"`
	}
	_, err = parser.ParseWithClaims(tokenString, &claims, func(token *jwt.Token) (any, error) {
		require.Equal(t, key.KeyID, token.Header["kid"], "JWT 头必须带 kid 便于轮换识别")
		return parsed, nil
	})
	require.NoError(t, err)
	require.NotEmpty(t, claims.Subject)
	return claims.Subject, claims.Org
}

func newACFPluginTestService(t *testing.T, baseURL string, summaries IdentityOrganizationLookup, orgs OrganizationRepository) *ACFPluginService {
	t.Helper()
	_, private, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)
	return &ACFPluginService{
		key:       mustACFPluginKeyPair(t, private),
		issuer:    ACFPluginIssuerDefault,
		audience:  ACFPluginAudienceDefault,
		baseURL:   strings.TrimRight(baseURL, "/"),
		client:    &http.Client{},
		now:       time.Now,
		summaries: summaries,
		orgs:      orgs,
	}
}

func mustACFPluginKeyPair(t *testing.T, private ed25519.PrivateKey) *ACFPluginKeyPair {
	t.Helper()
	key, err := newACFPluginKeyPair(private)
	require.NoError(t, err)
	return key
}

type stubIdentityOrgLookup struct {
	summaries map[int64]*OrganizationSummary
}

func (s *stubIdentityOrgLookup) GetSummaryByUserID(ctx context.Context, userID int64) (*OrganizationSummary, error) {
	return s.summaries[userID], nil
}

type stubOrganizationRepo struct {
	orgs map[int64]*Organization
}

func (r *stubOrganizationRepo) Create(ctx context.Context, organization *Organization) error {
	return errors.New("not implemented")
}
func (r *stubOrganizationRepo) CreateMember(ctx context.Context, member *OrganizationMembership) error {
	return errors.New("not implemented")
}
func (r *stubOrganizationRepo) GetByID(ctx context.Context, id int64) (*Organization, error) {
	if org, ok := r.orgs[id]; ok {
		return org, nil
	}
	return nil, ErrOrganizationNotFound
}
func (r *stubOrganizationRepo) GetMembershipByUserID(ctx context.Context, userID int64) (*OrganizationMembership, error) {
	return nil, ErrOrganizationMembershipNotFound
}
func (r *stubOrganizationRepo) ListInvitations(ctx context.Context, organizationID int64, limit int) ([]RedeemCode, error) {
	return nil, nil
}
func (r *stubOrganizationRepo) DisableInvitation(ctx context.Context, organizationID int64, invitationID int64) error {
	return nil
}

func TestACFPluginAssertionMatchesACFVerificationRules(t *testing.T) {
	_, private, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)
	key := mustACFPluginKeyPair(t, private)
	svc := &ACFPluginService{
		key: key, issuer: "sub2api", audience: "acf-plugin",
		now: time.Now,
	}

	token, err := svc.SignAssertion(13, 12)
	require.NoError(t, err)
	sub, org := verifyACFPluginAssertion(t, key, "sub2api", "acf-plugin", token)
	// 编号铁律：断言里的编号必须与身份解析返回的字符串完全一致。
	require.Equal(t, "13", sub)
	require.Equal(t, "12", org)
}

func TestACFPluginKeyPairPersistsAndReloads(t *testing.T) {
	keyFile := filepath.Join(t.TempDir(), "keys", acfPluginKeyFileName)

	first, err := LoadOrCreateACFPluginKeyPair(keyFile)
	require.NoError(t, err)
	info, err := os.Stat(keyFile)
	require.NoError(t, err)
	if runtime.GOOS != "windows" {
		// Windows 的 FAT/ACL 不映射 Unix 权限位，该断言只在 Unix 体系有意义。
		require.True(t, info.Mode().Perm()&0o077 == 0, "私钥文件不能对组/其他用户开放读权限")
	}

	reloaded, err := LoadOrCreateACFPluginKeyPair(keyFile)
	require.NoError(t, err)
	require.True(t, first.Private.Equal(reloaded.Private), "重载后的私钥必须与首次生成一致")

	pemPublic, err := first.PublicKeyPEM()
	require.NoError(t, err)
	require.Contains(t, pemPublic, "BEGIN PUBLIC KEY")
}

func TestACFPluginCorruptKeyFileFailsLoud(t *testing.T) {
	keyFile := filepath.Join(t.TempDir(), acfPluginKeyFileName)
	require.NoError(t, os.WriteFile(keyFile, []byte("not a pem"), 0o600))
	_, err := LoadOrCreateACFPluginKeyPair(keyFile)
	require.Error(t, err)
}

func TestACFPluginAuthorizeOwnerUsesOwnOrg(t *testing.T) {
	svc := &ACFPluginService{
		summaries: &stubIdentityOrgLookup{summaries: map[int64]*OrganizationSummary{
			13: {ID: 12, Name: "某某科技", IsOwner: true},
		}},
	}
	orgID, err := svc.AuthorizePluginView(context.Background(), 13, RoleUser, nil)
	require.NoError(t, err)
	require.Equal(t, int64(12), orgID)
}

func TestACFPluginAuthorizeNonOwnerForbidden(t *testing.T) {
	svc := &ACFPluginService{
		summaries: &stubIdentityOrgLookup{summaries: map[int64]*OrganizationSummary{
			13: {ID: 12, Name: "某某科技", IsOwner: false},
		}},
	}
	_, err := svc.AuthorizePluginView(context.Background(), 13, RoleUser, nil)
	require.ErrorIs(t, err, ErrACFPluginForbidden)

	_, err = svc.AuthorizePluginView(context.Background(), 99, RoleUser, nil)
	require.ErrorIs(t, err, ErrACFPluginForbidden)

	other := int64(99)
	_, err = svc.AuthorizePluginView(context.Background(), 13, RoleUser, &other)
	require.ErrorIs(t, err, ErrACFPluginForbidden)
}

func TestACFPluginAuthorizePlatformAdmin(t *testing.T) {
	orgRepo := &stubOrganizationRepo{orgs: map[int64]*Organization{
		7: {ID: 7, Name: "平台任意组织"},
	}}
	svc := &ACFPluginService{orgs: orgRepo}

	// 平台管理员不指定组织 = 缺参数。
	_, err := svc.AuthorizePluginView(context.Background(), 1, RoleAdmin, nil)
	require.ErrorIs(t, err, ErrACFPluginOrgRequired)

	// 指定不存在的组织 = 404 语义。
	missing := int64(404)
	_, err = svc.AuthorizePluginView(context.Background(), 1, RoleAdmin, &missing)
	require.ErrorIs(t, err, ErrOrganizationNotFound)

	// 指定存在的组织 = 放行该组织。
	orgID, err := svc.AuthorizePluginView(context.Background(), 1, RoleAdmin, func() *int64 { v := int64(7); return &v }())
	require.NoError(t, err)
	require.Equal(t, int64(7), orgID)
}

func TestACFPluginQueryProxiesWithAssertion(t *testing.T) {
	var gotAuth, gotFrom, gotTo string
	var gotPath string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		gotFrom = r.URL.Query().Get("from")
		gotTo = r.URL.Query().Get("to")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{"requests": 5})
	}))
	defer upstream.Close()

	svc := newACFPluginTestService(t, upstream.URL, nil, nil)

	from := time.Unix(1730000000, 0)
	to := from.Add(24 * time.Hour)
	status, body, err := svc.QueryPluginData(context.Background(), 13, 12, ACFPluginEndpointSummary, from, to)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, status)
	require.Contains(t, string(body), `"requests":5`)

	require.True(t, strings.HasPrefix(gotAuth, "Bearer "), "必须以 Bearer 断言调用")
	token := strings.TrimPrefix(gotAuth, "Bearer ")
	sub, org := verifyACFPluginAssertion(t, svc.key, svc.issuer, svc.audience, token)
	require.Equal(t, "13", sub)
	require.Equal(t, "12", org)
	require.True(t, strings.HasSuffix(gotPath, "/api/v1/plugin/summary"), "实际路径: %s", gotPath)
	require.Equal(t, from.Format(time.RFC3339), gotFrom)
	require.Equal(t, to.Format(time.RFC3339), gotTo)
}

func TestACFPluginQueryPassesUpstreamStatusThrough(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":{"code":"org_not_found"}}`))
	}))
	defer upstream.Close()
	svc := newACFPluginTestService(t, upstream.URL, nil, nil)

	status, body, err := svc.QueryPluginData(context.Background(), 13, 12, ACFPluginEndpointRecentEvents,
		time.Unix(1730000000, 0), time.Unix(1730086400, 0))
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, status)
	require.Contains(t, string(body), "org_not_found")
}

func TestACFPluginQueryRejectsUnknownEndpoint(t *testing.T) {
	svc := newACFPluginTestService(t, "http://127.0.0.1:1", nil, nil)
	_, _, err := svc.QueryPluginData(context.Background(), 13, 12, "../admin", time.Now(), time.Now().Add(time.Hour))
	require.ErrorIs(t, err, ErrACFPluginUnknownEndpoint)
}

func TestACFPluginDisabledServiceErrors(t *testing.T) {
	var nilService *ACFPluginService
	_, err := nilService.SignAssertion(13, 12)
	require.ErrorIs(t, err, ErrACFPluginDisabled)
	_, _, err = nilService.QueryPluginData(context.Background(), 13, 12, ACFPluginEndpointSummary, time.Now(), time.Now())
	require.ErrorIs(t, err, ErrACFPluginDisabled)

	// base_url 为空时功能关闭：装配直接返回 nil 服务，代理路由按关闭响应。
	disabled, err := ProvideACFPluginService(&config.Config{}, nil, nil)
	require.NoError(t, err)
	require.Nil(t, disabled)
}
