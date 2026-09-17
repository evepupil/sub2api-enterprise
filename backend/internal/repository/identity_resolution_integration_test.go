//go:build integration

package repository

// ACF 网关身份解析的端到端契约测试：测试本身扮演 ACF 客户端，按契约
// （Bearer 服务凭证 + JSON 请求体）发请求，验证归属落库语义与 HTTP 行为。
// 它和 ACF 仓库里那份「假 Sub2API」互为镜像，两份合起来就是契约的可执行版。

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/ent/apikey"
	"github.com/Wei-Shaw/sub2api/ent/organizationmember"
	"github.com/Wei-Shaw/sub2api/ent/user"
	"github.com/Wei-Shaw/sub2api/internal/handler"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type identityContractFixture struct {
	router        *gin.Engine
	credential    string
	memberKey     string
	disabledKey   string
	personalKey   string
	orgID         int64
	memberUserID  int64
	disabledKeyID int64
}

type identityContractOrganization struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type identityContractResponse struct {
	Organization *identityContractOrganization `json:"organization"`
	User         struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"user"`
	Key struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"key"`
}

func newIdentityContractFixture(t *testing.T) *identityContractFixture {
	t.Helper()
	ctx := context.Background()
	gin.SetMode(gin.TestMode)

	suffix := time.Now().UnixNano()
	owner, err := integrationEntClient.User.Create().
		SetEmail(fmt.Sprintf("acf-owner-%d@example.com", suffix)).
		SetPasswordHash("test-password-hash").
		Save(ctx)
	require.NoError(t, err)
	member, err := integrationEntClient.User.Create().
		SetEmail(fmt.Sprintf("acf-member-%d@example.com", suffix)).
		SetPasswordHash("test-password-hash").
		SetUsername("zhangsan").
		Save(ctx)
	require.NoError(t, err)
	personal, err := integrationEntClient.User.Create().
		SetEmail(fmt.Sprintf("acf-personal-%d@example.com", suffix)).
		SetPasswordHash("test-password-hash").
		SetUsername("lisi").
		Save(ctx)
	require.NoError(t, err)

	apiKeyRepo := NewAPIKeyRepository(integrationEntClient, integrationDB)
	organizationRepo := NewOrganizationRepository(integrationEntClient)
	organization := &service.Organization{Name: "某某科技", OwnerUserID: owner.ID}
	require.NoError(t, organizationRepo.Create(ctx, organization))
	require.NoError(t, organizationRepo.CreateMember(ctx, &service.OrganizationMembership{
		OrganizationID: organization.ID,
		UserID:         member.ID,
		DisplayName:    "张三备注",
	}))

	memberKey := &service.APIKey{UserID: member.ID, Key: fmt.Sprintf("sk-it-member-%d", suffix), Name: "CI 专用", Status: service.StatusActive}
	require.NoError(t, apiKeyRepo.Create(ctx, memberKey))
	disabledKey := &service.APIKey{UserID: member.ID, Key: fmt.Sprintf("sk-it-disabled-%d", suffix), Name: "已停用", Status: service.StatusDisabled}
	require.NoError(t, apiKeyRepo.Create(ctx, disabledKey))
	personalKey := &service.APIKey{UserID: personal.ID, Key: fmt.Sprintf("sk-it-personal-%d", suffix), Name: "自用", Status: service.StatusActive}
	require.NoError(t, apiKeyRepo.Create(ctx, personalKey))

	orgService := service.NewOrganizationService(organizationRepo, NewRedeemCodeRepository(integrationEntClient))
	identityHandler := handler.NewIdentityResolutionHandler(service.NewIdentityResolutionService(apiKeyRepo, orgService))

	const credential = "integration-acf-credential"
	router := gin.New()
	internal := router.Group("/api/internal",
		gin.HandlerFunc(middleware.NewServiceCredentialAuthMiddleware(credential)),
		middleware.NewServiceRateLimitMiddleware(),
		middleware.RequestBodyLimit(8<<10),
	)
	internal.POST("/identity/resolve", identityHandler.Resolve)

	fixture := &identityContractFixture{
		router:        router,
		credential:    credential,
		memberKey:     memberKey.Key,
		disabledKey:   disabledKey.Key,
		personalKey:   personalKey.Key,
		orgID:         organization.ID,
		memberUserID:  member.ID,
		disabledKeyID: disabledKey.ID,
	}
	t.Cleanup(func() {
		cleanupCtx := context.Background()
		_, _ = integrationEntClient.APIKey.Delete().Where(apikey.UserIDIn(owner.ID, member.ID, personal.ID)).Exec(cleanupCtx)
		_, _ = integrationEntClient.OrganizationMember.Delete().Where(organizationmember.OrganizationIDEQ(organization.ID)).Exec(cleanupCtx)
		_ = integrationEntClient.Organization.DeleteOneID(organization.ID).Exec(cleanupCtx)
		_, _ = integrationEntClient.User.Delete().Where(user.IDIn(owner.ID, member.ID, personal.ID)).Exec(cleanupCtx)
	})
	return fixture
}

func performIdentityResolve(f *identityContractFixture, credential, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/internal/identity/resolve", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if credential != "" {
		req.Header.Set("Authorization", "Bearer "+credential)
	}
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec
}

func TestIdentityResolutionContractMemberAttribution(t *testing.T) {
	f := newIdentityContractFixture(t)

	rec := performIdentityResolve(f, f.credential, fmt.Sprintf(`{"api_key":%q}`, f.memberKey))
	require.Equal(t, http.StatusOK, rec.Code)

	var payload identityContractResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))
	// 编号以字符串返回；名字按 备注 > 用户名 > 邮箱 取值。
	require.NotNil(t, payload.Organization)
	require.Equal(t, fmt.Sprintf("%d", f.orgID), payload.Organization.ID)
	require.Equal(t, "某某科技", payload.Organization.Name)
	require.Equal(t, fmt.Sprintf("%d", f.memberUserID), payload.User.ID)
	require.Equal(t, "张三备注", payload.User.Name)
	require.Equal(t, "CI 专用", payload.Key.Name)
}

func TestIdentityResolutionContractDisabledKeyStillAttributed(t *testing.T) {
	// 停用密钥照样答归属：能不能用由正常鉴权链路决定，这里只回答「谁发的」。
	f := newIdentityContractFixture(t)

	rec := performIdentityResolve(f, f.credential, fmt.Sprintf(`{"api_key":%q}`, f.disabledKey))
	require.Equal(t, http.StatusOK, rec.Code)

	var payload identityContractResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))
	require.NotNil(t, payload.Organization)
	require.Equal(t, "张三备注", payload.User.Name)
}

func TestIdentityResolutionContractPersonalUserOrganizationNull(t *testing.T) {
	f := newIdentityContractFixture(t)

	rec := performIdentityResolve(f, f.credential, fmt.Sprintf(`{"api_key":%q}`, f.personalKey))
	require.Equal(t, http.StatusOK, rec.Code)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))
	value, exists := payload["organization"]
	require.True(t, exists, "organization 字段必须存在且为 null")
	require.Nil(t, value)
}

func TestIdentityResolutionContractUnknownKeyNotFound(t *testing.T) {
	f := newIdentityContractFixture(t)

	rec := performIdentityResolve(f, f.credential, `{"api_key":"sk-it-never-exists"}`)
	require.Equal(t, http.StatusNotFound, rec.Code)
	require.JSONEq(t, `{"error":{"code":"key_not_found"}}`, rec.Body.String())
}

func TestIdentityResolutionContractDeletedKeyNotFound(t *testing.T) {
	f := newIdentityContractFixture(t)
	ctx := context.Background()
	key, err := integrationEntClient.APIKey.Query().
		Where(apikey.IDEQ(f.disabledKeyID)).
		Only(ctx)
	require.NoError(t, err)
	require.NoError(t, NewAPIKeyRepository(integrationEntClient, integrationDB).Delete(ctx, key.ID))

	rec := performIdentityResolve(f, f.credential, fmt.Sprintf(`{"api_key":%q}`, f.disabledKey))
	require.Equal(t, http.StatusNotFound, rec.Code)
	require.JSONEq(t, `{"error":{"code":"key_not_found"}}`, rec.Body.String())
}

func TestIdentityResolutionContractCredentialEnforced(t *testing.T) {
	f := newIdentityContractFixture(t)

	missing := performIdentityResolve(f, "", `{"api_key":"sk-anything"}`)
	require.Equal(t, http.StatusUnauthorized, missing.Code)
	require.JSONEq(t, `{"error":{"code":"unauthorized"}}`, missing.Body.String())

	wrong := performIdentityResolve(f, "wrong-credential", `{"api_key":"sk-anything"}`)
	require.Equal(t, http.StatusUnauthorized, wrong.Code)
}

func TestIdentityResolutionContractMalformedBodyBadRequest(t *testing.T) {
	f := newIdentityContractFixture(t)

	rec := performIdentityResolve(f, f.credential, `not-json`)
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.JSONEq(t, `{"error":{"code":"invalid_request"}}`, rec.Body.String())
}
