package routes

// 内部服务路由：给 ACF 安全网关等可信服务调用，与面板、模型网关路由
// 完全分开，不挂面板限流与页面链路的任何中间件。
//
// 路径落在 /api/v1 下是部署侧的约定：ACF 网关从公网直连本接口，
// 边缘只为这一条路径开例外，不需要再为 /api/internal 单开一段转发。
// 因此本组的防护完全由下面三个中间件承担，不依赖路径前缀做隔离。
//
// 服务凭证未配置时整组不注册——内部接口宁可不服务，也不留一个
// 不设防的入口。

import (
	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/handler"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"

	"github.com/gin-gonic/gin"
)

// identityResolveMaxBodyBytes 解析请求只有一个密钥字段，8KB 绰绰有余；
// 更大的请求体直接在读取阶段被掐断。
const identityResolveMaxBodyBytes = 8 << 10

// RegisterInternalRoutes 注册内部服务接口。
func RegisterInternalRoutes(r *gin.Engine, h *handler.Handlers, cfg *config.Config) {
	credential := cfg.ACF.IdentityCredential
	if credential == "" {
		return
	}

	identity := r.Group("/api/v1/identity",
		gin.HandlerFunc(middleware.NewServiceCredentialAuthMiddleware(credential)),
		middleware.NewServiceRateLimitMiddleware(),
		middleware.RequestBodyLimit(identityResolveMaxBodyBytes),
	)
	identity.POST("/resolve", h.IdentityResolution.Resolve)
}
