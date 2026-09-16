package handler

import (
	"strconv"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// OrganizationQuotaRequestHandler 暴露组织配额申请的策略配置、成员提交与审批。
// 组织范围和申请人身份都由服务端根据登录身份确定，请求里不接受组织标识。
type OrganizationQuotaRequestHandler struct {
	service *service.OrganizationMemberService
}

func NewOrganizationQuotaRequestHandler(service *service.OrganizationMemberService) *OrganizationQuotaRequestHandler {
	return &OrganizationQuotaRequestHandler{service: service}
}

// organizationQuotaRequestPolicyResponse 的 min / max 为 null 表示关闭申请。
type organizationQuotaRequestPolicyResponse struct {
	Mode      string   `json:"mode"`
	MinAmount *float64 `json:"min_amount"`
	MaxAmount *float64 `json:"max_amount"`
}

type updateOrganizationQuotaRequestPolicyRequest struct {
	Mode      string   `json:"mode"`
	MinAmount *float64 `json:"min_amount"`
	MaxAmount *float64 `json:"max_amount"`
}

type submitOrganizationQuotaRequestRequest struct {
	Amount float64 `json:"amount"`
	Reason string  `json:"reason"`
}

type reviewOrganizationQuotaRequestRequest struct {
	Note string `json:"note"`
}

// organizationQuotaRequestResponse 是申请列表里的一行。
// snapshot_* 是提交时刻的模式快照，归档用；grant_source 仅已发放时有值。
type organizationQuotaRequestResponse struct {
	ID            int64      `json:"id"`
	UserID        int64      `json:"user_id"`
	Email         string     `json:"email"`
	Username      string     `json:"username"`
	DisplayName   string     `json:"display_name"`
	Amount        float64    `json:"amount"`
	Reason        string     `json:"reason"`
	Status        string     `json:"status"`
	GrantSource   *string    `json:"grant_source"`
	GrantedAmount *float64   `json:"granted_amount"`
	SnapshotMode  string     `json:"snapshot_mode"`
	ReviewNote    string     `json:"review_note"`
	ReviewedAt    *time.Time `json:"reviewed_at"`
	CreatedAt     time.Time  `json:"created_at"`
}

// GetPolicy 读取本组织的申请策略。
// GET /api/v1/organization/quota-request-policy
func (h *OrganizationQuotaRequestHandler) GetPolicy(c *gin.Context) {
	userID, ok := organizationUserID(c)
	if !ok {
		return
	}
	policy, err := h.service.GetQuotaRequestPolicy(c.Request.Context(), userID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationQuotaRequestPolicyResponse{
		Mode:      policy.Mode,
		MinAmount: policy.Min,
		MaxAmount: policy.Max,
	})
}

// UpdatePolicy 修改本组织的申请策略。
// PUT /api/v1/organization/quota-request-policy
func (h *OrganizationQuotaRequestHandler) UpdatePolicy(c *gin.Context) {
	userID, ok := organizationUserID(c)
	if !ok {
		return
	}
	var req updateOrganizationQuotaRequestPolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	policy, err := h.service.UpdateQuotaRequestPolicy(c.Request.Context(), userID, req.Mode, req.MinAmount, req.MaxAmount)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationQuotaRequestPolicyResponse{
		Mode:      policy.Mode,
		MinAmount: policy.Min,
		MaxAmount: policy.Max,
	})
}

// List 列出申请：组织创建者看本组织，普通成员只看自己的。
// GET /api/v1/organization/quota-requests
func (h *OrganizationQuotaRequestHandler) List(c *gin.Context) {
	userID, ok := organizationUserID(c)
	if !ok {
		return
	}
	page, pageSize := response.ParsePagination(c)
	requests, result, err := h.service.ListQuotaRequests(
		c.Request.Context(),
		userID,
		pagination.PaginationParams{Page: page, PageSize: pageSize},
		service.OrganizationQuotaRequestListFilters{Status: c.Query("status")},
	)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	items := make([]organizationQuotaRequestResponse, 0, len(requests))
	for i := range requests {
		items = append(items, organizationQuotaRequestFromService(&requests[i]))
	}
	total := int64(len(items))
	if result != nil {
		total = result.Total
	}
	response.Paginated(c, items, total, page, pageSize)
}

// Submit 成员提交一笔配额申请。
// POST /api/v1/organization/quota-requests
func (h *OrganizationQuotaRequestHandler) Submit(c *gin.Context) {
	userID, ok := organizationUserID(c)
	if !ok {
		return
	}
	var req submitOrganizationQuotaRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	request, err := h.service.SubmitQuotaRequest(c.Request.Context(), userID, req.Amount, req.Reason)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationQuotaRequestFromService(request))
}

// Withdraw 成员撤回自己的一笔待处理申请。
// POST /api/v1/organization/quota-requests/:id/withdraw
func (h *OrganizationQuotaRequestHandler) Withdraw(c *gin.Context) {
	userID, ok := organizationUserID(c)
	if !ok {
		return
	}
	requestID, ok := organizationQuotaRequestID(c)
	if !ok {
		return
	}
	request, err := h.service.WithdrawQuotaRequest(c.Request.Context(), userID, requestID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationQuotaRequestFromService(request))
}

// Approve 组织管理员通过一笔待处理申请。
// POST /api/v1/organization/quota-requests/:id/approve
func (h *OrganizationQuotaRequestHandler) Approve(c *gin.Context) {
	userID, ok := organizationUserID(c)
	if !ok {
		return
	}
	requestID, ok := organizationQuotaRequestID(c)
	if !ok {
		return
	}
	var req reviewOrganizationQuotaRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	request, err := h.service.ApproveQuotaRequest(c.Request.Context(), userID, requestID, req.Note)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationQuotaRequestFromService(request))
}

// Reject 组织管理员驳回一笔待处理申请。
// POST /api/v1/organization/quota-requests/:id/reject
func (h *OrganizationQuotaRequestHandler) Reject(c *gin.Context) {
	userID, ok := organizationUserID(c)
	if !ok {
		return
	}
	requestID, ok := organizationQuotaRequestID(c)
	if !ok {
		return
	}
	var req reviewOrganizationQuotaRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	request, err := h.service.RejectQuotaRequest(c.Request.Context(), userID, requestID, req.Note)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationQuotaRequestFromService(request))
}

func organizationQuotaRequestID(c *gin.Context) (int64, bool) {
	requestID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || requestID <= 0 {
		response.BadRequest(c, "Invalid quota request id")
		return 0, false
	}
	return requestID, true
}

func organizationQuotaRequestFromService(request *service.OrganizationQuotaRequest) organizationQuotaRequestResponse {
	if request == nil {
		return organizationQuotaRequestResponse{}
	}
	return organizationQuotaRequestResponse{
		ID:            request.ID,
		UserID:        request.UserID,
		Email:         request.Email,
		Username:      request.Username,
		DisplayName:   request.DisplayName,
		Amount:        request.Amount,
		Reason:        request.Reason,
		Status:        request.Status,
		GrantSource:   request.GrantSource,
		GrantedAmount: request.GrantedAmount,
		SnapshotMode:  request.SnapshotMode,
		ReviewNote:    request.ReviewNote,
		ReviewedAt:    request.ReviewedAt,
		CreatedAt:     request.CreatedAt,
	}
}
