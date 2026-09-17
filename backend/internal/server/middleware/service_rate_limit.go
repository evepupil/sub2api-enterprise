package middleware

// 内部服务接口的轻量限流。
//
// 身份解析这类接口的正常流量约等于「新密钥出现的频率」，离阈值很远；
// 设这道闸的目的：万一服务凭证泄露，把拿接口暴力枚举密钥的速率压住，
// 让泄露可被发现、被轮换，而不是安静地变成一个字典攻击器。

import (
	"net/http"

	"golang.org/x/time/rate"

	"github.com/gin-gonic/gin"
)

const (
	// serviceRateLimitPerSecond 稳态每秒放行的请求数。ACF 对同一把密钥只问
	// 一次，真实流量离这个数差几个数量级。
	serviceRateLimitPerSecond = 20
	// serviceRateBurst 允许的短时突发：新密钥集中上线的一批首次请求。
	serviceRateBurst = 40
)

// NewServiceRateLimitMiddleware 构造进程内的固定速率限流中间件，超限返回 429。
func NewServiceRateLimitMiddleware() gin.HandlerFunc {
	return newServiceRateLimitMiddleware(serviceRateLimitPerSecond, serviceRateBurst)
}

// newServiceRateLimitMiddleware 供生产默认值与测试注入确定的速率、突发参数。
func newServiceRateLimitMiddleware(limit rate.Limit, burst int) gin.HandlerFunc {
	limiter := rate.NewLimiter(limit, burst)
	return func(c *gin.Context) {
		if !limiter.Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": gin.H{"code": "rate_limited"}})
			return
		}
		c.Next()
	}
}
