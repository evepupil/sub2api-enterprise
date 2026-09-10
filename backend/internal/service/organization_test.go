package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type organizationRepoStub struct {
	organizations map[int64]*Organization
	memberships   map[int64]*OrganizationMembership
	invitations   []RedeemCode
	nextID        int64
}

func newOrganizationRepoStub() *organizationRepoStub {
	return &organizationRepoStub{
		organizations: map[int64]*Organization{},
		memberships:   map[int64]*OrganizationMembership{},
		nextID:        1,
	}
}

func (r *organizationRepoStub) Create(_ context.Context, organization *Organization) error {
	for _, existing := range r.organizations {
		if existing.OwnerUserID == organization.OwnerUserID {
			return ErrUserAlreadyInOrganization
		}
	}
	organization.ID = r.nextID
	r.nextID++
	organization.CreatedAt = time.Now().UTC()
	organization.UpdatedAt = organization.CreatedAt
	copyValue := *organization
	r.organizations[organization.ID] = &copyValue
	return nil
}

func (r *organizationRepoStub) CreateMember(_ context.Context, member *OrganizationMembership) error {
	if _, exists := r.memberships[member.UserID]; exists {
		return ErrUserAlreadyInOrganization
	}
	member.ID = int64(len(r.memberships) + 1)
	member.CreatedAt = time.Now().UTC()
	member.UpdatedAt = member.CreatedAt
	copyValue := *member
	r.memberships[member.UserID] = &copyValue
	return nil
}

func (r *organizationRepoStub) GetByID(_ context.Context, id int64) (*Organization, error) {
	value, ok := r.organizations[id]
	if !ok {
		return nil, ErrOrganizationNotFound
	}
	copyValue := *value
	return &copyValue, nil
}

func (r *organizationRepoStub) GetMembershipByUserID(_ context.Context, userID int64) (*OrganizationMembership, error) {
	value, ok := r.memberships[userID]
	if !ok {
		return nil, ErrOrganizationMembershipNotFound
	}
	copyValue := *value
	if organization, exists := r.organizations[value.OrganizationID]; exists {
		organizationCopy := *organization
		copyValue.Organization = &organizationCopy
	}
	return &copyValue, nil
}

func (r *organizationRepoStub) ListInvitations(_ context.Context, organizationID int64, _ int) ([]RedeemCode, error) {
	result := make([]RedeemCode, 0)
	for _, invitation := range r.invitations {
		if invitation.OrganizationID != nil && *invitation.OrganizationID == organizationID {
			result = append(result, invitation)
		}
	}
	return result, nil
}

type organizationRedeemRepoStub struct {
	RedeemCodeRepository
	codes  map[string]*RedeemCode
	nextID int64
}

func newOrganizationRedeemRepoStub(codes ...*RedeemCode) *organizationRedeemRepoStub {
	repo := &organizationRedeemRepoStub{codes: map[string]*RedeemCode{}, nextID: 1}
	for _, code := range codes {
		copyValue := *code
		if copyValue.ID == 0 {
			copyValue.ID = repo.nextID
		}
		if copyValue.ID >= repo.nextID {
			repo.nextID = copyValue.ID + 1
		}
		repo.codes[copyValue.Code] = &copyValue
	}
	return repo
}

func (r *organizationRedeemRepoStub) GetByCode(_ context.Context, code string) (*RedeemCode, error) {
	value, ok := r.codes[code]
	if !ok {
		return nil, ErrRedeemCodeNotFound
	}
	copyValue := *value
	return &copyValue, nil
}

func (r *organizationRedeemRepoStub) Use(_ context.Context, id, userID int64) error {
	for _, value := range r.codes {
		if value.ID != id {
			continue
		}
		if !value.CanUse() {
			return ErrRedeemCodeUsed
		}
		now := time.Now().UTC()
		value.Status = StatusUsed
		value.UsedBy = &userID
		value.UsedAt = &now
		return nil
	}
	return ErrRedeemCodeNotFound
}

func (r *organizationRedeemRepoStub) Create(_ context.Context, code *RedeemCode) error {
	if _, exists := r.codes[code.Code]; exists {
		return errors.New("duplicate code")
	}
	code.ID = r.nextID
	r.nextID++
	code.CreatedAt = time.Now().UTC()
	copyValue := *code
	r.codes[code.Code] = &copyValue
	return nil
}

func TestOrganizationServiceResolveRegistrationIntent(t *testing.T) {
	ctx := context.Background()
	organizationRepo := newOrganizationRepoStub()
	organization := &Organization{Name: "Acme", OwnerUserID: 10}
	require.NoError(t, organizationRepo.Create(ctx, organization))
	organizationID := organization.ID
	redeemRepo := newOrganizationRedeemRepoStub(
		&RedeemCode{ID: 10, Code: "PLATFORM", Type: RedeemTypeInvitation, Status: StatusUnused},
		&RedeemCode{ID: 11, Code: "ORG", Type: RedeemTypeInvitation, Status: StatusUnused, OrganizationID: &organizationID},
	)
	expiredAt := time.Now().Add(-time.Minute)
	redeemRepo.codes["EXPIRED-ORG"] = &RedeemCode{
		ID:             12,
		Code:           "EXPIRED-ORG",
		Type:           RedeemTypeInvitation,
		Status:         StatusUnused,
		OrganizationID: &organizationID,
		ExpiresAt:      &expiredAt,
	}
	service := NewOrganizationService(organizationRepo, redeemRepo)

	t.Run("personal registration without gate", func(t *testing.T) {
		intent, err := service.ResolveRegistrationIntent(ctx, "", "", false)
		require.NoError(t, err)
		require.Equal(t, OrganizationRegistrationPersonal, intent.Kind)
		require.Nil(t, intent.Invitation)
	})

	t.Run("create organization with platform invitation", func(t *testing.T) {
		intent, err := service.ResolveRegistrationIntent(ctx, "  Example Team  ", "PLATFORM", true)
		require.NoError(t, err)
		require.Equal(t, OrganizationRegistrationCreate, intent.Kind)
		require.Equal(t, "Example Team", intent.OrganizationName)
		require.Equal(t, int64(10), intent.Invitation.ID)
	})

	t.Run("join organization", func(t *testing.T) {
		intent, err := service.ResolveRegistrationIntent(ctx, "", "ORG", false)
		require.NoError(t, err)
		require.Equal(t, OrganizationRegistrationJoin, intent.Kind)
		require.Equal(t, organizationID, intent.Organization.ID)
	})

	t.Run("organization invitation conflicts with create", func(t *testing.T) {
		_, err := service.ResolveRegistrationIntent(ctx, "Another Team", "ORG", true)
		require.ErrorIs(t, err, ErrOrganizationRegistrationConflict)
	})

	t.Run("platform invitation is not consumed when gate is off", func(t *testing.T) {
		intent, err := service.ResolveRegistrationIntent(ctx, "", "PLATFORM", false)
		require.NoError(t, err)
		require.Nil(t, intent.Invitation)
	})

	t.Run("invitation required", func(t *testing.T) {
		_, err := service.ResolveRegistrationIntent(ctx, "", "", true)
		require.ErrorIs(t, err, ErrInvitationCodeRequired)
	})

	t.Run("expired organization invitation", func(t *testing.T) {
		_, err := service.ResolveRegistrationIntent(ctx, "", "EXPIRED-ORG", false)
		require.ErrorIs(t, err, ErrInvitationCodeInvalid)
	})
}

func TestOrganizationServiceCompleteRegistration(t *testing.T) {
	ctx := context.Background()
	organizationRepo := newOrganizationRepoStub()
	redeemRepo := newOrganizationRedeemRepoStub(
		&RedeemCode{ID: 20, Code: "PLATFORM", Type: RedeemTypeInvitation, Status: StatusUnused},
	)
	service := NewOrganizationService(organizationRepo, redeemRepo)

	intent, err := service.ResolveRegistrationIntent(ctx, "Acme", "PLATFORM", true)
	require.NoError(t, err)
	summary, err := service.CompleteRegistration(ctx, 101, intent)
	require.NoError(t, err)
	require.True(t, summary.IsOwner)
	require.Equal(t, "Acme", summary.Name)

	membership, err := organizationRepo.GetMembershipByUserID(ctx, 101)
	require.NoError(t, err)
	require.Equal(t, summary.ID, membership.OrganizationID)
	claimed, err := redeemRepo.GetByCode(ctx, "PLATFORM")
	require.NoError(t, err)
	require.Equal(t, StatusUsed, claimed.Status)
}

func TestOrganizationServiceCompleteJoinRegistration(t *testing.T) {
	ctx := context.Background()
	organizationRepo := newOrganizationRepoStub()
	organization := &Organization{Name: "Acme", OwnerUserID: 100}
	require.NoError(t, organizationRepo.Create(ctx, organization))
	organizationID := organization.ID
	redeemRepo := newOrganizationRedeemRepoStub(
		&RedeemCode{
			ID:             21,
			Code:           "ORG",
			Type:           RedeemTypeInvitation,
			Status:         StatusUnused,
			OrganizationID: &organizationID,
		},
	)
	service := NewOrganizationService(organizationRepo, redeemRepo)

	intent, err := service.ResolveRegistrationIntent(ctx, "", "ORG", false)
	require.NoError(t, err)
	summary, err := service.CompleteRegistration(ctx, 101, intent)
	require.NoError(t, err)
	require.False(t, summary.IsOwner)
	require.Equal(t, organization.ID, summary.ID)

	membership, err := organizationRepo.GetMembershipByUserID(ctx, 101)
	require.NoError(t, err)
	require.Equal(t, organization.ID, membership.OrganizationID)
	claimed, err := redeemRepo.GetByCode(ctx, "ORG")
	require.NoError(t, err)
	require.Equal(t, StatusUsed, claimed.Status)
}

func TestOrganizationServiceCreateInvitationRequiresOwner(t *testing.T) {
	ctx := context.Background()
	organizationRepo := newOrganizationRepoStub()
	redeemRepo := newOrganizationRedeemRepoStub()
	service := NewOrganizationService(organizationRepo, redeemRepo)
	organization := &Organization{Name: "Acme", OwnerUserID: 1}
	require.NoError(t, organizationRepo.Create(ctx, organization))
	require.NoError(t, organizationRepo.CreateMember(ctx, &OrganizationMembership{OrganizationID: organization.ID, UserID: 1}))
	require.NoError(t, organizationRepo.CreateMember(ctx, &OrganizationMembership{OrganizationID: organization.ID, UserID: 2}))

	invitation, err := service.CreateInvitation(ctx, 1, nil)
	require.NoError(t, err)
	require.NotEmpty(t, invitation.Code)
	require.Equal(t, organization.ID, *invitation.OrganizationID)

	_, err = service.CreateInvitation(ctx, 2, nil)
	require.ErrorIs(t, err, ErrOrganizationOwnerRequired)
}
