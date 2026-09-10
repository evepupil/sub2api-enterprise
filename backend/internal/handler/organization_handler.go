package handler

import (
	"time"

	"github.com/Wei-Shaw/sub2api/internal/handler/dto"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	servermiddleware "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"

	"github.com/gin-gonic/gin"
)

type OrganizationHandler struct {
	service *service.OrganizationService
}

func NewOrganizationHandler(service *service.OrganizationService) *OrganizationHandler {
	return &OrganizationHandler{service: service}
}

func (h *OrganizationHandler) GetCurrent(c *gin.Context) {
	userID, ok := organizationUserID(c)
	if !ok {
		return
	}
	summary, err := h.service.GetSummaryByUserID(c.Request.Context(), userID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationSummaryDTO(summary))
}

type createOrganizationInvitationRequest struct {
	ExpiresAt *time.Time `json:"expires_at"`
}

type organizationInvitationResponse struct {
	ID        int64      `json:"id"`
	Code      string     `json:"code"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
}

func (h *OrganizationHandler) CreateInvitation(c *gin.Context) {
	userID, ok := organizationUserID(c)
	if !ok {
		return
	}
	var req createOrganizationInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	invitation, err := h.service.CreateInvitation(c.Request.Context(), userID, req.ExpiresAt)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	response.Success(c, organizationInvitationFromService(invitation))
}

func (h *OrganizationHandler) ListInvitations(c *gin.Context) {
	userID, ok := organizationUserID(c)
	if !ok {
		return
	}
	invitations, err := h.service.ListInvitations(c.Request.Context(), userID)
	if err != nil {
		response.ErrorFrom(c, err)
		return
	}
	items := make([]organizationInvitationResponse, 0, len(invitations))
	for i := range invitations {
		items = append(items, organizationInvitationFromService(&invitations[i]))
	}
	response.Success(c, items)
}

func organizationUserID(c *gin.Context) (int64, bool) {
	subject, ok := servermiddleware.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "User not authenticated")
		return 0, false
	}
	return subject.UserID, true
}

func organizationSummaryDTO(summary *service.OrganizationSummary) *dto.OrganizationSummary {
	if summary == nil {
		return nil
	}
	return &dto.OrganizationSummary{
		ID:        summary.ID,
		Name:      summary.Name,
		IsOwner:   summary.IsOwner,
		CreatedAt: summary.CreatedAt,
	}
}

func organizationInvitationFromService(invitation *service.RedeemCode) organizationInvitationResponse {
	if invitation == nil {
		return organizationInvitationResponse{}
	}
	return organizationInvitationResponse{
		ID:        invitation.ID,
		Code:      invitation.Code,
		Status:    invitation.Status,
		CreatedAt: invitation.CreatedAt,
		ExpiresAt: invitation.ExpiresAt,
		UsedAt:    invitation.UsedAt,
	}
}
