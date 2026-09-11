package admin

import (
	"strconv"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

// OrganizationHandler 提供平台管理员的组织管理能力：查看全平台组织并配置其分组范围。
type OrganizationHandler struct {
	service *service.AdminOrganizationService
}

func NewOrganizationHandler(service *service.AdminOrganizationService) *OrganizationHandler {
	return &OrganizationHandler{service: service}
}

// organizationResponse 是平台组织管理页看到的一个组织。
// restrict_public_groups 为 false 时公开分组全部可用，allowed_group_ids 只约束专属分组。
type organizationResponse struct {
	ID                   int64     `json:"id"`
	Name                 string    `json:"name"`
	OwnerUserID          int64     `json:"owner_user_id"`
	OwnerEmail           string    `json:"owner_email"`
	OwnerUsername        string    `json:"owner_username"`
	MemberCount          int       `json:"member_count"`
	RestrictPublicGroups bool      `json:"restrict_public_groups"`
	AllowedGroupIDs      []int64   `json:"allowed_group_ids"`
	CreatedAt            time.Time `json:"created_at"`
}

type updateOrganizationGroupsRequest struct {
	RestrictPublicGroups bool    `json:"restrict_public_groups"`
	AllowedGroupIDs      []int64 `json:"allowed_group_ids"`
}

// List 返回全平台组织列表。
// GET /api/v1/admin/organizations
func (h *OrganizationHandler) List(c *gin.Context) {
	page, pageSize := response.ParsePagination(c)
	search := strings.TrimSpace(c.Query("search"))
	if len(search) > 200 {
		search = search[:200]
	}

	organizations, result, err := h.service.List(
		c.Request.Context(),
		pagination.PaginationParams{Page: page, PageSize: pageSize},
		service.AdminOrganizationListFilters{Search: search},
	)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	items := make([]organizationResponse, 0, len(organizations))
	for i := range organizations {
		items = append(items, organizationToResponse(&organizations[i]))
	}
	total := int64(len(items))
	if result != nil {
		total = result.Total
	}
	response.Paginated(c, items, total, page, pageSize)
}

// Get 返回单个组织的详情。
// GET /api/v1/admin/organizations/:id
func (h *OrganizationHandler) Get(c *gin.Context) {
	organizationID, ok := organizationIDParam(c)
	if !ok {
		return
	}
	organization, err := h.service.Get(c.Request.Context(), organizationID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationToResponse(organization))
}

// UpdateGroups 覆盖写入组织的分组范围。
// PUT /api/v1/admin/organizations/:id/groups
func (h *OrganizationHandler) UpdateGroups(c *gin.Context) {
	organizationID, ok := organizationIDParam(c)
	if !ok {
		return
	}
	var req updateOrganizationGroupsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	organization, err := h.service.UpdateGroups(
		c.Request.Context(),
		organizationID,
		req.RestrictPublicGroups,
		req.AllowedGroupIDs,
	)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationToResponse(organization))
}

func organizationIDParam(c *gin.Context) (int64, bool) {
	organizationID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || organizationID <= 0 {
		response.BadRequest(c, "Invalid organization id")
		return 0, false
	}
	return organizationID, true
}

func organizationToResponse(organization *service.AdminOrganization) organizationResponse {
	if organization == nil {
		return organizationResponse{}
	}
	allowedGroupIDs := organization.AllowedGroupIDs
	if allowedGroupIDs == nil {
		allowedGroupIDs = []int64{}
	}
	return organizationResponse{
		ID:                   organization.ID,
		Name:                 organization.Name,
		OwnerUserID:          organization.OwnerUserID,
		OwnerEmail:           organization.OwnerEmail,
		OwnerUsername:        organization.OwnerUsername,
		MemberCount:          organization.MemberCount,
		RestrictPublicGroups: organization.RestrictPublicGroups,
		AllowedGroupIDs:      allowedGroupIDs,
		CreatedAt:            organization.CreatedAt,
	}
}
