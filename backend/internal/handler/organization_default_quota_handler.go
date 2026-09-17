package handler

import (
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// organizationDefaultQuotaResponse 是组织默认周期配额配置。
// enabled 为 false 时 amount / period_days 为空；开启后新成员完成加入时
// 自动抄入这份配置，周期从加入时刻起算。
type organizationDefaultQuotaResponse struct {
	Enabled    bool     `json:"enabled"`
	Amount     *float64 `json:"amount"`
	PeriodDays *int     `json:"period_days"`
}

// updateOrganizationDefaultQuotaRequest 的两个同步开关决定存量成员是否一起换：
// sync_unconfigured 只补没配周期配额的成员，sync_configured 只覆盖已配的成员，
// 两者都开等于全员统一立即重置，都不开则只影响之后加入的成员。
type updateOrganizationDefaultQuotaRequest struct {
	Enabled          bool     `json:"enabled"`
	Amount           *float64 `json:"amount"`
	PeriodDays       *int     `json:"period_days"`
	SyncUnconfigured bool     `json:"sync_unconfigured"`
	SyncConfigured   bool     `json:"sync_configured"`
}

// GetDefaultQuota 读取本组织的默认周期配额配置。
func (h *OrganizationMemberHandler) GetDefaultQuota(c *gin.Context) {
	actorUserID, ok := organizationUserID(c)
	if !ok {
		return
	}
	quota, err := h.service.GetDefaultQuota(c.Request.Context(), actorUserID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationDefaultQuotaToResponse(quota))
}

// UpdateDefaultQuota 保存默认周期配额，可同时按开关同步存量成员。
func (h *OrganizationMemberHandler) UpdateDefaultQuota(c *gin.Context) {
	actorUserID, ok := organizationUserID(c)
	if !ok {
		return
	}
	var req updateOrganizationDefaultQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	update := service.OrganizationDefaultQuotaUpdate{
		Enabled:          req.Enabled,
		SyncUnconfigured: req.SyncUnconfigured,
		SyncConfigured:   req.SyncConfigured,
	}
	if req.Enabled {
		if req.Amount == nil || req.PeriodDays == nil {
			response.BadRequest(c, "amount and period_days are required when enabled")
			return
		}
		update.Amount = *req.Amount
		update.PeriodDays = *req.PeriodDays
	}
	synced, err := h.service.UpdateDefaultQuota(c.Request.Context(), actorUserID, update)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, gin.H{
		"quota":        organizationDefaultQuotaToResponse(&synced.Quota),
		"synced_users": synced.SyncedUsers(),
	})
}

func organizationDefaultQuotaToResponse(
	quota *service.OrganizationDefaultQuota,
) *organizationDefaultQuotaResponse {
	if quota == nil {
		return nil
	}
	return &organizationDefaultQuotaResponse{
		Enabled:    quota.Enabled,
		Amount:     quota.Amount,
		PeriodDays: quota.PeriodDays,
	}
}
