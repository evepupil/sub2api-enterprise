package handler

import (
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// PublicStatusHandler 提供匿名可访问的服务状态页数据。
//
// 这个接口谁都能打，所以两条纪律：
//   - 开关默认关，读不到设置按关处理（fail-closed）；
//   - 只回传分组名、状态档位和可用率，不回传请求量、错误详情和上游信息。
//     具体脱敏规则写在 service.PublicStatusService 的注释里，加字段前先读那段。
type PublicStatusHandler struct {
	statusService *service.PublicStatusService
}

// NewPublicStatusHandler 创建对外状态 handler。
func NewPublicStatusHandler(statusService *service.PublicStatusService) *PublicStatusHandler {
	return &PublicStatusHandler{statusService: statusService}
}

// Get 返回脱敏后的服务状态。
// GET /api/v1/status
func (h *PublicStatusHandler) Get(c *gin.Context) {
	if h.statusService == nil {
		response.NotFound(c, "Service status page is not enabled")
		return
	}
	ctx := c.Request.Context()
	if !h.statusService.Enabled(ctx) {
		response.NotFound(c, "Service status page is not enabled")
		return
	}

	status, err := h.statusService.Get(ctx)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, status)
}
