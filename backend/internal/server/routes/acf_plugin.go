package routes

// 组织防护只读插件页的代理路由（M3 模块 3）。
//
// 挂在面板 v1 组上，走控制台会话认证与面板限流；功能未配置
// （acf.plugin.base_url 为空）时服务为 nil，处理器对所有请求返回
// feature_disabled，与解析接口「不配置即关闭」的哲学一致。

import (
	"github.com/Wei-Shaw/sub2api/internal/handler"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// RegisterACFPluginRoutes 注册组织防护插件页的代理路由。
func RegisterACFPluginRoutes(
	v1 *gin.RouterGroup,
	h *handler.Handlers,
	jwtAuth middleware.JWTAuthMiddleware,
	settingService *service.SettingService,
	panelRateLimiter *middleware.PanelRateLimiter,
) {
	authenticated := v1.Group("")
	authenticated.Use(gin.HandlerFunc(jwtAuth))
	authenticated.Use(middleware.BackendModeUserGuard(settingService))
	authenticated.Use(panelRateLimiter.Global())

	plugin := authenticated.Group("/acf-plugin")
	{
		plugin.GET("/summary", h.ACFPlugin.Summary)
		plugin.GET("/trend", h.ACFPlugin.Trend)
		plugin.GET("/risk-types", h.ACFPlugin.RiskTypes)
		plugin.GET("/top-actors", h.ACFPlugin.TopActors)
		plugin.GET("/recent-events", h.ACFPlugin.RecentEvents)
	}
}
