package middleware

// 服务间调用的固定凭证认证：ACF 安全网关调用内部服务接口（如身份解析）时，
// 以 Bearer 方式携带部署时约定的服务凭证。
//
// 安全底线：没有凭证的内部接口等于把客户的原始调用密钥挂在一个不设防的
// 探测器上——谁都能拿它批量试探某把密钥是否存在。所以凭证未配置时直接
// 503 拒绝（正常情况下路由层根本不会注册这组接口，这里是双保险），
// 凭证比对走常数时间，避免时序侧信道。

import (
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// ServiceCredentialAuthMiddleware 服务间固定凭证认证中间件类型。
type ServiceCredentialAuthMiddleware gin.HandlerFunc

// NewServiceCredentialAuthMiddleware 用部署时约定的服务凭证构造认证中间件。
func NewServiceCredentialAuthMiddleware(credential string) ServiceCredentialAuthMiddleware {
	digest := sha256.Sum256([]byte(credential))
	expected := digest[:]
	return ServiceCredentialAuthMiddleware(func(c *gin.Context) {
		if credential == "" {
			respondServiceAPIError(c, http.StatusServiceUnavailable, "service_disabled")
			return
		}
		token, ok := bearerToken(c.GetHeader("Authorization"))
		if !ok || !serviceCredentialEqual(token, expected) {
			respondServiceAPIError(c, http.StatusUnauthorized, "unauthorized")
			return
		}
		c.Next()
	})
}

// bearerToken 解析「Bearer <token>」形态的 Authorization 头。
func bearerToken(header string) (string, bool) {
	const scheme = "Bearer "
	if !strings.HasPrefix(header, scheme) {
		return "", false
	}
	token := strings.TrimPrefix(header, scheme)
	if token == "" {
		return "", false
	}
	return token, true
}

// serviceCredentialEqual 以 SHA-256 摘要做常数时间比较：
// 长度差异不提前暴露，逐字节比较也不随匹配进度变化。
func serviceCredentialEqual(provided string, expectedDigest []byte) bool {
	sum := sha256.Sum256([]byte(provided))
	return subtle.ConstantTimeCompare(sum[:], expectedDigest) == 1
}

func respondServiceAPIError(c *gin.Context, status int, code string) {
	c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"code": code}})
}
