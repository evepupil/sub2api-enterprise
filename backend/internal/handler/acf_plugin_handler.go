package handler

// 组织防护只读插件页的代理接口（M3 模块 3）。
//
// 五条端点镜像 ACF 侧 /api/v1/plugin/*：鉴权走控制台会话，组织范围由
// 服务端锁定（组织管理员=本人归属，平台管理员=显式 org_id 且仅平台
// 管理员可传），每次调用现签断言转发。ACF 返回的状态码与 JSON 原样
// 透传给插件页——语义（401 断言、404 未接入、400 窗口）由两边契约共
// 同保证，代理层不做二次解释。

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// acfPluginWindowDefault / acfPluginWindowMax 与 ACF 侧插件端点的窗口
// 规则保持一致：缺省近 30 天，跨度上限 90 天。
const (
	acfPluginWindowDefault = 30 * 24 * time.Hour
	acfPluginWindowMax     = 90 * 24 * time.Hour
)

type ACFPluginHandler struct {
	plugin *service.ACFPluginService
}

func NewACFPluginHandler(plugin *service.ACFPluginService) *ACFPluginHandler {
	return &ACFPluginHandler{plugin: plugin}
}

// Summary 三口径 + 空窗 + 处置分布。
func (h *ACFPluginHandler) Summary(c *gin.Context) {
	h.proxy(c, service.ACFPluginEndpointSummary)
}

// Trend 请求与风险趋势。
func (h *ACFPluginHandler) Trend(c *gin.Context) {
	h.proxy(c, service.ACFPluginEndpointTrend)
}

// RiskTypes 风险类型分布。
func (h *ACFPluginHandler) RiskTypes(c *gin.Context) {
	h.proxy(c, service.ACFPluginEndpointRiskTypes)
}

// TopActors 成员触发榜。
func (h *ACFPluginHandler) TopActors(c *gin.Context) {
	h.proxy(c, service.ACFPluginEndpointTopActors)
}

// RecentEvents 最近风险事件。
func (h *ACFPluginHandler) RecentEvents(c *gin.Context) {
	h.proxy(c, service.ACFPluginEndpointRecentEvents)
}

func (h *ACFPluginHandler) proxy(c *gin.Context, endpoint service.ACFPluginDataEndpoint) {
	if h.plugin == nil {
		respondACFPluginError(c, http.StatusNotFound, "feature_disabled")
		return
	}
	subject, ok := middleware.GetAuthSubjectFromContext(c)
	if !ok {
		respondACFPluginError(c, http.StatusUnauthorized, "unauthorized")
		return
	}
	role, _ := middleware.GetUserRoleFromContext(c)

	var orgIDParam *int64
	if raw := c.Query("org_id"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			respondACFPluginError(c, http.StatusBadRequest, "invalid_org_id")
			return
		}
		orgIDParam = &id
	}

	orgID, err := h.plugin.AuthorizePluginView(c.Request.Context(), subject.UserID, role, orgIDParam)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrACFPluginForbidden):
			respondACFPluginError(c, http.StatusForbidden, "forbidden")
		case errors.Is(err, service.ErrACFPluginOrgRequired):
			respondACFPluginError(c, http.StatusBadRequest, "org_id_required")
		case errors.Is(err, service.ErrOrganizationNotFound):
			respondACFPluginError(c, http.StatusNotFound, "org_not_found")
		default:
			logger.LegacyPrintf("acf_plugin", "authorize outcome=error err=%v", err)
			respondACFPluginError(c, http.StatusInternalServerError, "internal_error")
		}
		return
	}

	from, to, err := acfPluginWindow(c)
	if err != nil {
		respondACFPluginError(c, http.StatusBadRequest, "invalid_window")
		return
	}

	started := time.Now()
	status, body, err := h.plugin.QueryPluginData(c.Request.Context(), subject.UserID, orgID, endpoint, from, to)
	if err != nil {
		if errors.Is(err, service.ErrACFPluginDisabled) {
			respondACFPluginError(c, http.StatusNotFound, "feature_disabled")
			return
		}
		logger.LegacyPrintf("acf_plugin", "proxy outcome=error endpoint=%s err=%v", endpoint, err)
		respondACFPluginError(c, http.StatusBadGateway, "acf_unavailable")
		return
	}
	logger.LegacyPrintf("acf_plugin", "proxy outcome=ok endpoint=%s org=%d user=%d upstream=%d latency_ms=%d",
		endpoint, orgID, subject.UserID, status, time.Since(started).Milliseconds())
	c.Data(status, "application/json; charset=utf-8", body)
}

// acfPluginWindow 解析 from/to（RFC3339，可选；缺省近 30 天，上限 90 天）。
func acfPluginWindow(c *gin.Context) (from, to time.Time, err error) {
	to = time.Now()
	from = to.Add(-acfPluginWindowDefault)
	if raw := c.Query("from"); raw != "" {
		if from, err = time.Parse(time.RFC3339, raw); err != nil {
			return from, to, err
		}
	}
	if raw := c.Query("to"); raw != "" {
		if to, err = time.Parse(time.RFC3339, raw); err != nil {
			return from, to, err
		}
	}
	if !from.Before(to) || to.Sub(from) > acfPluginWindowMax {
		return from, to, service.ErrACFPluginWindowInvalid
	}
	return from, to, nil
}

func respondACFPluginError(c *gin.Context, status int, code string) {
	c.JSON(status, gin.H{"error": gin.H{"code": code}})
}
