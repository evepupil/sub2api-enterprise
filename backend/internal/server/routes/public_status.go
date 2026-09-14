package routes

import (
	"github.com/Wei-Shaw/sub2api/internal/handler"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterPublicStatusRoutes 注册对外服务状态页的数据接口。
//
// 匿名可访问，所以只挂公网限流，不挂鉴权。开关由 handler 侧 fail-closed 判定，
// 关闭时返回 404 而不是 403——不确认这个接口存在，少给一条探测路径。
func RegisterPublicStatusRoutes(
	v1 *gin.RouterGroup,
	h *handler.Handlers,
	panelRateLimiter *middleware.PanelRateLimiter,
) {
	status := v1.Group("/status")
	status.Use(panelRateLimiter.PublicIP())
	{
		status.GET("", h.PublicStatus.Get)
	}
}
