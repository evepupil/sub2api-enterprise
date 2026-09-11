package handler

import (
	"strconv"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// OrganizationMemberHandler 暴露组织管理员对本组织成员的管理能力。
// 组织范围由服务端根据登录身份确定，请求里不接受组织标识。
type OrganizationMemberHandler struct {
	service *service.OrganizationMemberService
}

func NewOrganizationMemberHandler(service *service.OrganizationMemberService) *OrganizationMemberHandler {
	return &OrganizationMemberHandler{service: service}
}

// organizationMemberResponse 是成员管理页看到的一行。
// spending_limit 为 null 表示不限额，0 表示完全不能消费。
// spending_remaining 在不限额时同样为 null。
type organizationMemberResponse struct {
	UserID            int64     `json:"user_id"`
	Email             string    `json:"email"`
	Username          string    `json:"username"`
	Status            string    `json:"status"`
	IsOwner           bool      `json:"is_owner"`
	SpendingLimit     *float64  `json:"spending_limit"`
	SpendingUsed      float64   `json:"spending_used"`
	SpendingRemaining *float64  `json:"spending_remaining"`
	JoinedAt          time.Time `json:"joined_at"`
}

type updateOrganizationMemberStatusRequest struct {
	Status string `json:"status"`
}

// updateOrganizationMemberSpendingLimitRequest 的 spending_limit 为 null 表示改为不限额。
type updateOrganizationMemberSpendingLimitRequest struct {
	SpendingLimit *float64 `json:"spending_limit"`
}

type splitOrganizationMemberSpendingLimitRequest struct {
	UserIDs     []int64 `json:"user_ids"`
	TotalAmount float64 `json:"total_amount"`
}

func (h *OrganizationMemberHandler) List(c *gin.Context) {
	userID, ok := organizationUserID(c)
	if !ok {
		return
	}
	page, pageSize := response.ParsePagination(c)
	members, result, err := h.service.List(
		c.Request.Context(),
		userID,
		pagination.PaginationParams{Page: page, PageSize: pageSize},
		service.OrganizationMemberListFilters{
			Search: c.Query("search"),
			Status: c.Query("status"),
		},
	)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	items := organizationMembersToResponse(members)
	total := int64(len(items))
	if result != nil {
		total = result.Total
	}
	response.Paginated(c, items, total, page, pageSize)
}

func (h *OrganizationMemberHandler) UpdateStatus(c *gin.Context) {
	actorUserID, ok := organizationUserID(c)
	if !ok {
		return
	}
	targetUserID, ok := organizationMemberUserID(c)
	if !ok {
		return
	}
	var req updateOrganizationMemberStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	member, err := h.service.UpdateStatus(c.Request.Context(), actorUserID, targetUserID, req.Status)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationMemberToResponse(member))
}

func (h *OrganizationMemberHandler) UpdateSpendingLimit(c *gin.Context) {
	actorUserID, ok := organizationUserID(c)
	if !ok {
		return
	}
	targetUserID, ok := organizationMemberUserID(c)
	if !ok {
		return
	}
	var req updateOrganizationMemberSpendingLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	member, err := h.service.UpdateSpendingLimit(c.Request.Context(), actorUserID, targetUserID, req.SpendingLimit)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationMemberToResponse(member))
}

func (h *OrganizationMemberHandler) SplitSpendingLimit(c *gin.Context) {
	actorUserID, ok := organizationUserID(c)
	if !ok {
		return
	}
	var req splitOrganizationMemberSpendingLimitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	members, err := h.service.SplitSpendingLimit(c.Request.Context(), actorUserID, req.UserIDs, req.TotalAmount)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationMembersToResponse(members))
}

func organizationMemberUserID(c *gin.Context) (int64, bool) {
	userID, err := strconv.ParseInt(c.Param("user_id"), 10, 64)
	if err != nil || userID <= 0 {
		response.BadRequest(c, "Invalid member id")
		return 0, false
	}
	return userID, true
}

func organizationMemberToResponse(member *service.OrganizationMember) *organizationMemberResponse {
	if member == nil {
		return nil
	}
	return &organizationMemberResponse{
		UserID:            member.UserID,
		Email:             member.Email,
		Username:          member.Username,
		Status:            member.Status,
		IsOwner:           member.IsOwner,
		SpendingLimit:     member.SpendingLimit,
		SpendingUsed:      member.SpendingUsed,
		SpendingRemaining: member.SpendingRemaining(),
		JoinedAt:          member.JoinedAt,
	}
}

func organizationMembersToResponse(members []service.OrganizationMember) []organizationMemberResponse {
	items := make([]organizationMemberResponse, 0, len(members))
	for i := range members {
		converted := organizationMemberToResponse(&members[i])
		if converted == nil {
			continue
		}
		items = append(items, *converted)
	}
	return items
}
