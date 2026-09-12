package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

const (
	OrganizationRegistrationPersonal = "personal"
	OrganizationRegistrationCreate   = "create_organization"
	OrganizationRegistrationJoin     = "join_organization"
)

var (
	ErrOrganizationNotFound = infraerrors.NotFound(
		"ORGANIZATION_NOT_FOUND",
		"organization not found",
	)
	ErrOrganizationMembershipNotFound = infraerrors.NotFound(
		"ORGANIZATION_MEMBERSHIP_NOT_FOUND",
		"organization membership not found",
	)
	ErrOrganizationOwnerRequired = infraerrors.Forbidden(
		"ORGANIZATION_OWNER_REQUIRED",
		"organization owner permission is required",
	)
	ErrOrganizationNameInvalid = infraerrors.BadRequest(
		"ORGANIZATION_NAME_INVALID",
		"organization name must contain between 1 and 100 characters",
	)
	ErrOrganizationRegistrationConflict = infraerrors.BadRequest(
		"ORGANIZATION_REGISTRATION_CONFLICT",
		"organization name cannot be used with an organization invitation",
	)
	ErrUserAlreadyInOrganization = infraerrors.Conflict(
		"USER_ALREADY_IN_ORGANIZATION",
		"user already belongs to an organization",
	)
)

type Organization struct {
	ID          int64
	Name        string
	OwnerUserID int64
	Status      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// IsDisabled 表示整个组织已停止服务。
func (o *Organization) IsDisabled() bool {
	return o != nil && o.Status == StatusDisabled
}

type OrganizationMembership struct {
	ID             int64
	OrganizationID int64
	UserID         int64
	CreatedAt      time.Time
	UpdatedAt      time.Time
	Organization   *Organization
}

type OrganizationSummary struct {
	ID        int64
	Name      string
	IsOwner   bool
	Status    string
	CreatedAt time.Time
}

type OrganizationRegistrationIntent struct {
	Kind             string
	OrganizationName string
	Organization     *Organization
	Invitation       *RedeemCode
}

type OrganizationRepository interface {
	Create(ctx context.Context, organization *Organization) error
	CreateMember(ctx context.Context, member *OrganizationMembership) error
	GetByID(ctx context.Context, id int64) (*Organization, error)
	GetMembershipByUserID(ctx context.Context, userID int64) (*OrganizationMembership, error)
	ListInvitations(ctx context.Context, organizationID int64, limit int) ([]RedeemCode, error)
	// DisableInvitation 把组织自己的邀请码置为停用。
	DisableInvitation(ctx context.Context, organizationID int64, invitationID int64) error
}

type OrganizationService struct {
	repo       OrganizationRepository
	redeemRepo RedeemCodeRepository
}

func NewOrganizationService(repo OrganizationRepository, redeemRepo RedeemCodeRepository) *OrganizationService {
	return &OrganizationService{repo: repo, redeemRepo: redeemRepo}
}

func normalizeOrganizationName(value string) (string, error) {
	name := strings.TrimSpace(value)
	if name == "" || utf8.RuneCountInString(name) > 100 {
		return "", ErrOrganizationNameInvalid
	}
	return name, nil
}

func (s *OrganizationService) ResolveRegistrationIntent(
	ctx context.Context,
	organizationName string,
	invitationCode string,
	invitationRequired bool,
) (*OrganizationRegistrationIntent, error) {
	if s == nil || s.repo == nil || s.redeemRepo == nil {
		return nil, ErrServiceUnavailable
	}

	organizationName = strings.TrimSpace(organizationName)
	invitationCode = strings.TrimSpace(invitationCode)

	var invitation *RedeemCode
	if invitationCode != "" {
		loaded, err := s.redeemRepo.GetByCode(ctx, invitationCode)
		if err != nil || loaded == nil || loaded.Type != RedeemTypeInvitation || !loaded.CanUse() {
			return nil, ErrInvitationCodeInvalid
		}
		invitation = loaded
	}

	if invitation != nil && invitation.OrganizationID != nil {
		if organizationName != "" {
			return nil, ErrOrganizationRegistrationConflict
		}
		organization, err := s.repo.GetByID(ctx, *invitation.OrganizationID)
		if err != nil {
			if errors.Is(err, ErrOrganizationNotFound) {
				return nil, ErrInvitationCodeInvalid
			}
			return nil, err
		}
		// 组织被停用期间不能再拉新人进来：进来也调不通，还会堆出一批没用的账号。
		if organization.IsDisabled() {
			return nil, ErrOrganizationDisabled
		}
		return &OrganizationRegistrationIntent{
			Kind:         OrganizationRegistrationJoin,
			Organization: organization,
			Invitation:   invitation,
		}, nil
	}

	if invitationRequired && invitation == nil {
		return nil, ErrInvitationCodeRequired
	}
	if !invitationRequired {
		// Platform invitation codes are registration gates. When that gate is off,
		// accepting a supplied platform code must not consume it.
		invitation = nil
	}

	if organizationName != "" {
		name, err := normalizeOrganizationName(organizationName)
		if err != nil {
			return nil, err
		}
		return &OrganizationRegistrationIntent{
			Kind:             OrganizationRegistrationCreate,
			OrganizationName: name,
			Invitation:       invitation,
		}, nil
	}

	return &OrganizationRegistrationIntent{
		Kind:       OrganizationRegistrationPersonal,
		Invitation: invitation,
	}, nil
}

// CompleteRegistration applies an already validated registration intent. The
// caller owns the surrounding transaction.
func (s *OrganizationService) CompleteRegistration(
	ctx context.Context,
	userID int64,
	intent *OrganizationRegistrationIntent,
) (*OrganizationSummary, error) {
	if s == nil || s.repo == nil || s.redeemRepo == nil || intent == nil || userID <= 0 {
		return nil, ErrServiceUnavailable
	}

	var organization *Organization
	switch intent.Kind {
	case OrganizationRegistrationPersonal:
	case OrganizationRegistrationCreate:
		name, err := normalizeOrganizationName(intent.OrganizationName)
		if err != nil {
			return nil, err
		}
		organization = &Organization{Name: name, OwnerUserID: userID}
		if err := s.repo.Create(ctx, organization); err != nil {
			return nil, err
		}
		if err := s.repo.CreateMember(ctx, &OrganizationMembership{
			OrganizationID: organization.ID,
			UserID:         userID,
		}); err != nil {
			return nil, err
		}
	case OrganizationRegistrationJoin:
		if intent.Organization == nil || intent.Organization.ID <= 0 || intent.Invitation == nil {
			return nil, ErrInvitationCodeInvalid
		}
		organization = intent.Organization
		if err := s.repo.CreateMember(ctx, &OrganizationMembership{
			OrganizationID: organization.ID,
			UserID:         userID,
		}); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("unknown organization registration kind %q", intent.Kind)
	}

	// 组织邀请码是限时可重复使用的，有效期内不消耗，多个人可以用同一个码进来；
	// 平台邀请码仍然一次性占用。
	if intent.Invitation != nil && intent.Invitation.OrganizationID == nil {
		if err := s.redeemRepo.Use(ctx, intent.Invitation.ID, userID); err != nil {
			return nil, ErrInvitationCodeInvalid
		}
	}

	if organization == nil {
		return nil, nil
	}
	return &OrganizationSummary{
		ID:        organization.ID,
		Name:      organization.Name,
		IsOwner:   organization.OwnerUserID == userID,
		Status:    organization.Status,
		CreatedAt: organization.CreatedAt,
	}, nil
}

func (s *OrganizationService) GetSummaryByUserID(ctx context.Context, userID int64) (*OrganizationSummary, error) {
	if s == nil || s.repo == nil || userID <= 0 {
		return nil, nil
	}
	membership, err := s.repo.GetMembershipByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, ErrOrganizationMembershipNotFound) {
			return nil, nil
		}
		return nil, err
	}
	if membership == nil || membership.Organization == nil {
		return nil, ErrOrganizationNotFound
	}
	organization := membership.Organization
	return &OrganizationSummary{
		ID:        organization.ID,
		Name:      organization.Name,
		IsOwner:   organization.OwnerUserID == userID,
		Status:    organization.Status,
		CreatedAt: organization.CreatedAt,
	}, nil
}

func (s *OrganizationService) AttachSummary(ctx context.Context, user *User) error {
	if user == nil || user.ID <= 0 {
		return nil
	}
	summary, err := s.GetSummaryByUserID(ctx, user.ID)
	if err != nil {
		return err
	}
	user.Organization = summary
	return nil
}

func (s *OrganizationService) CreateInvitation(ctx context.Context, ownerUserID int64, expiresAt *time.Time) (*RedeemCode, error) {
	if s == nil || s.redeemRepo == nil {
		return nil, ErrServiceUnavailable
	}
	summary, err := s.GetSummaryByUserID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	if summary == nil || !summary.IsOwner {
		return nil, ErrOrganizationOwnerRequired
	}
	if expiresAt != nil && !expiresAt.After(time.Now()) {
		return nil, ErrRedeemCodeExpired
	}

	code, err := GenerateRedeemCode()
	if err != nil {
		return nil, fmt.Errorf("generate organization invitation: %w", err)
	}
	invitation := &RedeemCode{
		Code:           strings.ToUpper(code),
		Type:           RedeemTypeInvitation,
		Status:         StatusUnused,
		OrganizationID: &summary.ID,
		ExpiresAt:      expiresAt,
		Notes:          "organization invitation",
	}
	if err := s.redeemRepo.Create(ctx, invitation); err != nil {
		return nil, fmt.Errorf("create organization invitation: %w", err)
	}
	return invitation, nil
}

// DisableInvitation 作废一个组织邀请码。
//
// 限时可重复使用的码在有效期内对所有人开放，泄露后需要能立刻作废，所以提供这个入口。
func (s *OrganizationService) DisableInvitation(ctx context.Context, ownerUserID int64, invitationID int64) error {
	if s == nil || s.repo == nil || s.redeemRepo == nil {
		return ErrServiceUnavailable
	}
	summary, err := s.GetSummaryByUserID(ctx, ownerUserID)
	if err != nil {
		return err
	}
	if summary == nil || !summary.IsOwner {
		return ErrOrganizationOwnerRequired
	}
	invitation, err := s.redeemRepo.GetByID(ctx, invitationID)
	if err != nil || invitation == nil {
		return ErrInvitationCodeInvalid
	}
	// 只能作废本组织的邀请码，客户端传别人的标识一律拒绝。
	if invitation.OrganizationID == nil || *invitation.OrganizationID != summary.ID {
		return ErrInvitationCodeInvalid
	}
	return s.repo.DisableInvitation(ctx, summary.ID, invitationID)
}

func (s *OrganizationService) ListInvitations(ctx context.Context, ownerUserID int64) ([]RedeemCode, error) {
	summary, err := s.GetSummaryByUserID(ctx, ownerUserID)
	if err != nil {
		return nil, err
	}
	if summary == nil || !summary.IsOwner {
		return nil, ErrOrganizationOwnerRequired
	}
	return s.repo.ListInvitations(ctx, summary.ID, 100)
}
