package routes

import (
	"github.com/Wei-Shaw/sub2api/internal/handler"

	"github.com/gin-gonic/gin"
)

// registerOrganizationRoutes 注册组织自助管理路由。
//
// 这些接口只给组织创建者使用，组织范围由服务端根据登录身份确定，
// 请求里不接受组织标识；平台管理员的全平台用户管理仍走 /admin 下的接口。
func registerOrganizationRoutes(authenticated *gin.RouterGroup, h *handler.Handlers) {
	organization := authenticated.Group("/organization")
	{
		organization.GET("", h.Organization.GetCurrent)
		organization.GET("/invitations", h.Organization.ListInvitations)
		organization.POST("/invitations", h.Organization.CreateInvitation)
		organization.DELETE("/invitations/:id", h.Organization.DisableInvitation)

		organization.GET("/members", h.OrganizationMember.List)
		organization.PUT("/members/:user_id/status", h.OrganizationMember.UpdateStatus)
		organization.PUT("/members/:user_id/spending-limit", h.OrganizationMember.UpdateSpendingLimit)
		organization.PUT("/members/:user_id/quota", h.OrganizationMember.UpdateQuota)
		organization.POST("/members/spending-limit-split", h.OrganizationMember.SplitSpendingLimit)
		organization.POST("/members/quota-batch", h.OrganizationMember.BatchSetQuota)

		// 配额申请：策略只有组织创建者能配；提交、撤回由成员本人发起；
		// 列表按身份分流（创建者看本组织，成员只看自己）。
		organization.GET("/quota-request-policy", h.OrganizationQuotaRequest.GetPolicy)
		organization.PUT("/quota-request-policy", h.OrganizationQuotaRequest.UpdatePolicy)
		organization.GET("/quota-requests", h.OrganizationQuotaRequest.List)
		organization.POST("/quota-requests", h.OrganizationQuotaRequest.Submit)
		organization.POST("/quota-requests/:id/withdraw", h.OrganizationQuotaRequest.Withdraw)
		organization.POST("/quota-requests/:id/approve", h.OrganizationQuotaRequest.Approve)
		organization.POST("/quota-requests/:id/reject", h.OrganizationQuotaRequest.Reject)
	}
}

// registerAdminOrganizationRoutes 注册平台侧组织管理路由。
//
// 这组接口只对平台管理员开放，组织管理员和普通成员走 /organization 下的自助接口。
func registerAdminOrganizationRoutes(admin *gin.RouterGroup, h *handler.Handlers) {
	organizations := admin.Group("/organizations")
	{
		organizations.GET("", h.Admin.Organization.List)
		organizations.GET("/:id", h.Admin.Organization.Get)
		organizations.PUT("/:id/groups", h.Admin.Organization.UpdateGroups)
		organizations.PUT("/:id/status", h.Admin.Organization.UpdateStatus)
	}
}
