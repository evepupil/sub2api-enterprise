package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

func newServiceCredentialTestRouter(credential string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/resolve", gin.HandlerFunc(NewServiceCredentialAuthMiddleware(credential)), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return router
}

func performServiceRequest(router *gin.Engine, authorization string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/resolve", nil)
	if authorization != "" {
		req.Header.Set("Authorization", authorization)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func TestServiceCredentialMissingHeaderUnauthorized(t *testing.T) {
	router := newServiceCredentialTestRouter("secret-credential")
	require.Equal(t, http.StatusUnauthorized, performServiceRequest(router, "").Code)
}

func TestServiceCredentialNonBearerUnauthorized(t *testing.T) {
	router := newServiceCredentialTestRouter("secret-credential")
	require.Equal(t, http.StatusUnauthorized, performServiceRequest(router, "token secret-credential").Code)
}

func TestServiceCredentialWrongTokenUnauthorized(t *testing.T) {
	router := newServiceCredentialTestRouter("secret-credential")
	require.Equal(t, http.StatusUnauthorized, performServiceRequest(router, "Bearer wrong").Code)
}

func TestServiceCredentialCorrectTokenPasses(t *testing.T) {
	router := newServiceCredentialTestRouter("secret-credential")
	require.Equal(t, http.StatusOK, performServiceRequest(router, "Bearer secret-credential").Code)
}

func TestServiceCredentialUnconfiguredReturnsServiceUnavailable(t *testing.T) {
	// 没配凭证时宁可整个接口拒绝服务，也不留一个不设防的入口。
	router := newServiceCredentialTestRouter("")
	require.Equal(t, http.StatusServiceUnavailable, performServiceRequest(router, "Bearer anything").Code)
}

func TestServiceRateLimitBlocksBeyondBurst(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	// rate.Limit(0) 表示不补充令牌，只有初始的 2 个突发额度，
	// 让「第 3 个请求被限流」变成确定性结论。
	router.POST("/resolve", newServiceRateLimitMiddleware(rate.Limit(0), 2), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	require.Equal(t, http.StatusOK, performServiceRequest(router, "").Code)
	require.Equal(t, http.StatusOK, performServiceRequest(router, "").Code)
	require.Equal(t, http.StatusTooManyRequests, performServiceRequest(router, "").Code)
}
