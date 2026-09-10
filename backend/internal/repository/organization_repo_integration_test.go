//go:build integration

package repository

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/ent/organizationmember"
	"github.com/Wei-Shaw/sub2api/ent/redeemcode"
	"github.com/Wei-Shaw/sub2api/ent/user"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestOrganizationRepositoryPersistsSingleMembershipAndInvitations(t *testing.T) {
	ctx := context.Background()
	suffix := time.Now().UnixNano()
	owner, err := integrationEntClient.User.Create().
		SetEmail(fmt.Sprintf("organization-owner-%d@example.com", suffix)).
		SetPasswordHash("test-password-hash").
		Save(ctx)
	require.NoError(t, err)
	member, err := integrationEntClient.User.Create().
		SetEmail(fmt.Sprintf("organization-member-%d@example.com", suffix)).
		SetPasswordHash("test-password-hash").
		Save(ctx)
	require.NoError(t, err)

	organizationRepo := NewOrganizationRepository(integrationEntClient)
	redeemRepo := NewRedeemCodeRepository(integrationEntClient)
	organization := &service.Organization{Name: "Integration Team", OwnerUserID: owner.ID}
	require.NoError(t, organizationRepo.Create(ctx, organization))
	t.Cleanup(func() {
		cleanupCtx := context.Background()
		_, _ = integrationEntClient.RedeemCode.Delete().Where(redeemcode.OrganizationIDEQ(organization.ID)).Exec(cleanupCtx)
		_, _ = integrationEntClient.OrganizationMember.Delete().Where(organizationmember.OrganizationIDEQ(organization.ID)).Exec(cleanupCtx)
		_ = integrationEntClient.Organization.DeleteOneID(organization.ID).Exec(cleanupCtx)
		_, _ = integrationEntClient.User.Delete().Where(user.IDIn(owner.ID, member.ID)).Exec(cleanupCtx)
	})

	require.NoError(t, organizationRepo.CreateMember(ctx, &service.OrganizationMembership{
		OrganizationID: organization.ID,
		UserID:         owner.ID,
	}))
	require.NoError(t, organizationRepo.CreateMember(ctx, &service.OrganizationMembership{
		OrganizationID: organization.ID,
		UserID:         member.ID,
	}))

	membership, err := organizationRepo.GetMembershipByUserID(ctx, member.ID)
	require.NoError(t, err)
	require.Equal(t, organization.ID, membership.OrganizationID)
	require.Equal(t, organization.Name, membership.Organization.Name)

	err = organizationRepo.CreateMember(ctx, &service.OrganizationMembership{
		OrganizationID: organization.ID,
		UserID:         member.ID,
	})
	require.True(t, errors.Is(err, service.ErrUserAlreadyInOrganization))

	organizationID := organization.ID
	invitation := &service.RedeemCode{
		Code:           fmt.Sprintf("ORG-%d", suffix),
		Type:           service.RedeemTypeInvitation,
		Status:         service.StatusUnused,
		OrganizationID: &organizationID,
	}
	require.NoError(t, redeemRepo.Create(ctx, invitation))
	invitations, err := organizationRepo.ListInvitations(ctx, organization.ID, 10)
	require.NoError(t, err)
	require.Len(t, invitations, 1)
	require.Equal(t, organization.ID, *invitations[0].OrganizationID)
}
