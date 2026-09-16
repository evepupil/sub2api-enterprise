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
// spending_remaining 在不限额时同样为 null，按生效配额模式计算。
type organizationMemberResponse struct {
	UserID            int64                          `json:"user_id"`
	Email             string                         `json:"email"`
	Username          string                         `json:"username"`
	Status            string                         `json:"status"`
	IsOwner           bool                           `json:"is_owner"`
	SpendingLimit     *float64                       `json:"spending_limit"`
	SpendingUsed      float64                        `json:"spending_used"`
	SpendingFrozen    float64                        `json:"spending_frozen"`
	SpendingRemaining *float64                       `json:"spending_remaining"`
	Quota             *organizationMemberQuotaDetail `json:"quota"`
	JoinedAt          time.Time                      `json:"joined_at"`
}

// organizationMemberQuotaDetail 描述周期配额的配置与当前期窗口。
// mode 取 static / periodic_pending / periodic_active；
// window_start 与 window_end 仅在生效中有值，window_end 即下期重置时间。
type organizationMemberQuotaDetail struct {
	Mode        string     `json:"mode"`
	Amount      *float64   `json:"amount"`
	PeriodDays  *int       `json:"period_days"`
	StartAt     *time.Time `json:"start_at"`
	WindowStart *time.Time `json:"window_start"`
	WindowEnd   *time.Time `json:"window_end"`
}

type updateOrganizationMemberStatusRequest struct {
	Status string `json:"status"`
}

// updateOrganizationMemberSpendingLimitRequest 的 spending_limit 为 null 表示改为不限额。
type updateOrganizationMemberSpendingLimitRequest struct {
	SpendingLimit *float64 `json:"spending_limit"`
}

// periodicQuotaRequest 是一份周期配额配置；start_at 缺省取当前时刻。
type periodicQuotaRequest struct {
	Amount     float64   `json:"amount"`
	PeriodDays int       `json:"period_days"`
	StartAt    time.Time `json:"start_at"`
}

// updateOrganizationMemberQuotaRequest 的 quota 为 null 表示取消周期、回到静态模式。
type updateOrganizationMemberQuotaRequest struct {
	Quota *periodicQuotaRequest `json:"quota"`
}

type batchOrganizationMemberQuotaRequest struct {
	UserIDs []int64               `json:"user_ids"`
	Quota   *periodicQuotaRequest `json:"quota"`
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

// UpdateQuota 设定或取消单个成员的周期配额。
func (h *OrganizationMemberHandler) UpdateQuota(c *gin.Context) {
	actorUserID, ok := organizationUserID(c)
	if !ok {
		return
	}
	targetUserID, ok := organizationMemberUserID(c)
	if !ok {
		return
	}
	var req updateOrganizationMemberQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	member, err := h.service.UpdateQuota(c.Request.Context(), actorUserID, targetUserID, quotaRequestToInput(req.Quota))
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationMemberToResponse(member))
}

// BatchSetQuota 把同一份周期配额发给选中的普通成员。
func (h *OrganizationMemberHandler) BatchSetQuota(c *gin.Context) {
	actorUserID, ok := organizationUserID(c)
	if !ok {
		return
	}
	var req batchOrganizationMemberQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	members, err := h.service.BatchSetQuota(c.Request.Context(), actorUserID, req.UserIDs, quotaRequestToInput(req.Quota))
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationMembersToResponse(members))
}

// quotaRequestToInput 把接口请求转成服务输入；start_at 缺省取当前时刻。
func quotaRequestToInput(quota *periodicQuotaRequest) *service.PeriodicQuotaInput {
	if quota == nil {
		return nil
	}
	startAt := quota.StartAt
	if startAt.IsZero() {
		startAt = time.Now()
	}
	return &service.PeriodicQuotaInput{
		Amount:     quota.Amount,
		PeriodDays: quota.PeriodDays,
		StartAt:    startAt,
	}
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
		SpendingFrozen:    member.SpendingFrozen,
		SpendingRemaining: member.SpendingRemaining(),
		Quota:             organizationMemberQuotaToResponse(member.QuotaState(time.Now())),
		JoinedAt:          member.JoinedAt,
	}
}

func organizationMemberQuotaToResponse(state service.MemberQuotaState) *organizationMemberQuotaDetail {
	if state.Mode == service.QuotaModeStatic {
		return nil
	}
	return &organizationMemberQuotaDetail{
		Mode:        string(state.Mode),
		Amount:      state.Amount,
		PeriodDays:  state.PeriodDays,
		StartAt:     state.StartAt,
		WindowStart: state.CycleStart,
		WindowEnd:   state.WindowEnd,
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
