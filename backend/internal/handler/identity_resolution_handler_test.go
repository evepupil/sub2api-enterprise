package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type fakeIdentityResolutionKeys struct {
	keys map[string]*service.APIKey
}

func (f *fakeIdentityResolutionKeys) GetByKey(ctx context.Context, key string) (*service.APIKey, error) {
	if k, ok := f.keys[key]; ok {
		return k, nil
	}
	return nil, service.ErrAPIKeyNotFound
}

type fakeIdentityResolutionOrgs struct {
	summaries map[int64]*service.OrganizationSummary
}

func (f *fakeIdentityResolutionOrgs) GetSummaryByUserID(ctx context.Context, userID int64) (*service.OrganizationSummary, error) {
	return f.summaries[userID], nil
}

func newIdentityResolutionTestRouter(keys map[string]*service.APIKey, summaries map[int64]*service.OrganizationSummary) *gin.Engine {
	gin.SetMode(gin.TestMode)
	handler := NewIdentityResolutionHandler(service.NewIdentityResolutionService(
		&fakeIdentityResolutionKeys{keys: keys},
		&fakeIdentityResolutionOrgs{summaries: summaries},
	))
	router := gin.New()
	router.POST("/api/internal/identity/resolve", handler.Resolve)
	return router
}

func postIdentityResolve(router *gin.Engine, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/internal/identity/resolve", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func identityResolutionMemberFixture() (*gin.Engine, *service.APIKey, *service.OrganizationSummary) {
	owner := &service.APIKey{
		ID:     7,
		UserID: 13,
		Key:    "sk-member",
		Name:   "CI 专用",
		User:   &service.User{ID: 13, Username: "zhangsan", Email: "zhangsan@example.com"},
	}
	summary := &service.OrganizationSummary{ID: 12, Name: "某某科技", DisplayName: "张三备注"}
	return newIdentityResolutionTestRouter(map[string]*service.APIKey{"sk-member": owner}, map[int64]*service.OrganizationSummary{13: summary}), owner, summary
}

func TestIdentityResolutionHandlerMemberResponseMatchesContract(t *testing.T) {
	router, _, summary := identityResolutionMemberFixture()

	rec := postIdentityResolve(router, `{"api_key":"sk-member"}`)
	require.Equal(t, http.StatusOK, rec.Code)

	// 契约形状：编号是字符串字段，三层各自带名字。
	var payload struct {
		Organization *struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"organization"`
		User struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"user"`
		Key struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"key"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))
	require.NotNil(t, payload.Organization)
	require.Equal(t, "12", payload.Organization.ID)
	require.Equal(t, summary.Name, payload.Organization.Name)
	require.Equal(t, "13", payload.User.ID)
	require.Equal(t, "张三备注", payload.User.Name)
	require.Equal(t, "7", payload.Key.ID)
	require.Equal(t, "CI 专用", payload.Key.Name)
}

func TestIdentityResolutionHandlerPersonalUserOrganizationNull(t *testing.T) {
	personal := &service.APIKey{
		ID:     9,
		UserID: 21,
		Key:    "sk-personal",
		Name:   "自用",
		User:   &service.User{ID: 21, Username: "lisi", Email: "lisi@example.com"},
	}
	router := newIdentityResolutionTestRouter(map[string]*service.APIKey{"sk-personal": personal}, nil)

	rec := postIdentityResolve(router, `{"api_key":"sk-personal"}`)
	require.Equal(t, http.StatusOK, rec.Code)

	// 空即个人：organization 字段必须是 JSON null，而不是缺失。
	var payload map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &payload))
	value, exists := payload["organization"]
	require.True(t, exists)
	require.Nil(t, value)
	userNode, ok := payload["user"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "21", userNode["id"])
}

func TestIdentityResolutionHandlerUnknownKeyNotFound(t *testing.T) {
	router, _, _ := identityResolutionMemberFixture()

	rec := postIdentityResolve(router, `{"api_key":"sk-unknown"}`)
	require.Equal(t, http.StatusNotFound, rec.Code)
	require.JSONEq(t, `{"error":{"code":"key_not_found"}}`, rec.Body.String())
}

func TestIdentityResolutionHandlerOverlongKeyTreatedAsNotFound(t *testing.T) {
	// 契约约定「格式不对」归 404：格式不对的密钥不可能存在。
	router, _, _ := identityResolutionMemberFixture()

	rec := postIdentityResolve(router, `{"api_key":"`+strings.Repeat("a", 200)+`"}`)
	require.Equal(t, http.StatusNotFound, rec.Code)
	require.JSONEq(t, `{"error":{"code":"key_not_found"}}`, rec.Body.String())
}

func TestIdentityResolutionHandlerInvalidBodyBadRequest(t *testing.T) {
	router, _, _ := identityResolutionMemberFixture()

	require.Equal(t, http.StatusBadRequest, postIdentityResolve(router, `not-json`).Code)
	require.Equal(t, http.StatusBadRequest, postIdentityResolve(router, `{}`).Code)
	require.Equal(t, http.StatusBadRequest, postIdentityResolve(router, `{"api_key":"  "}`).Code)
}
