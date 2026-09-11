//go:build integration

package repository

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/ent/organizationmember"
	"github.com/Wei-Shaw/sub2api/ent/user"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

// seedOrganizationWithMembers 建一个组织，带创建者和若干普通成员。
func seedOrganizationWithMembers(t *testing.T, ctx context.Context, memberCount int) (*service.Organization, []int64) {
	t.Helper()

	suffix := time.Now().UnixNano()
	owner, err := integrationEntClient.User.Create().
		SetEmail(fmt.Sprintf("member-quota-owner-%d@example.com", suffix)).
		SetUsername("quota-owner").
		SetPasswordHash("test-password-hash").
		Save(ctx)
	require.NoError(t, err)

	userIDs := []int64{owner.ID}
	for i := 0; i < memberCount; i++ {
		created, err := integrationEntClient.User.Create().
			SetEmail(fmt.Sprintf("member-quota-%d-%d@example.com", i, suffix)).
			SetUsername(fmt.Sprintf("quota-member-%d", i)).
			SetPasswordHash("test-password-hash").
			Save(ctx)
		require.NoError(t, err)
		userIDs = append(userIDs, created.ID)
	}

	organizationRepo := NewOrganizationRepository(integrationEntClient)
	organization := &service.Organization{Name: "Quota Team", OwnerUserID: owner.ID}
	require.NoError(t, organizationRepo.Create(ctx, organization))
	for _, userID := range userIDs {
		require.NoError(t, organizationRepo.CreateMember(ctx, &service.OrganizationMembership{
			OrganizationID: organization.ID,
			UserID:         userID,
		}))
	}

	t.Cleanup(func() {
		cleanupCtx := context.Background()
		_, _ = integrationEntClient.OrganizationMember.Delete().
			Where(organizationmember.OrganizationIDEQ(organization.ID)).Exec(cleanupCtx)
		_ = integrationEntClient.Organization.DeleteOneID(organization.ID).Exec(cleanupCtx)
		_, _ = integrationEntClient.User.Delete().Where(user.IDIn(userIDs...)).Exec(cleanupCtx)
	})

	return organization, userIDs
}

func TestOrganizationMemberRepositoryListsOwnOrganizationOnly(t *testing.T) {
	ctx := context.Background()
	organization, userIDs := seedOrganizationWithMembers(t, ctx, 2)
	otherOrganization, otherUserIDs := seedOrganizationWithMembers(t, ctx, 1)
	repo := NewOrganizationMemberRepository(integrationEntClient)

	members, result, err := repo.List(ctx, organization.ID, pagination.DefaultPagination(), service.OrganizationMemberListFilters{})
	require.NoError(t, err)
	require.EqualValues(t, len(userIDs), result.Total)
	require.Len(t, members, len(userIDs))

	owners := 0
	for _, member := range members {
		require.NotContains(t, otherUserIDs, member.UserID, "不能看到其他组织的成员")
		require.Nil(t, member.SpendingLimit, "新成员默认不限额")
		require.Zero(t, member.SpendingUsed)
		if member.IsOwner {
			owners++
		}
	}
	require.Equal(t, 1, owners, "列表里包含且只包含一位组织管理员")

	// 其他组织的成员只能从它自己的组织读到。
	_, err = repo.Get(ctx, otherOrganization.ID, userIDs[1])
	require.True(t, errors.Is(err, service.ErrOrganizationMemberNotFound))
}

func TestOrganizationMemberRepositoryFiltersAndHidesDeletedUsers(t *testing.T) {
	ctx := context.Background()
	organization, userIDs := seedOrganizationWithMembers(t, ctx, 2)
	repo := NewOrganizationMemberRepository(integrationEntClient)

	require.NoError(t, integrationEntClient.User.UpdateOneID(userIDs[1]).
		SetStatus("disabled").Exec(ctx))
	members, _, err := repo.List(ctx, organization.ID, pagination.DefaultPagination(), service.OrganizationMemberListFilters{
		Status: "disabled",
	})
	require.NoError(t, err)
	require.Len(t, members, 1)
	require.Equal(t, userIDs[1], members[0].UserID)

	members, _, err = repo.List(ctx, organization.ID, pagination.DefaultPagination(), service.OrganizationMemberListFilters{
		Search: "quota-member-1",
	})
	require.NoError(t, err)
	require.Len(t, members, 1)
	require.Equal(t, userIDs[2], members[0].UserID)

	// 软删除的账号不再出现在成员列表里。
	require.NoError(t, integrationEntClient.User.UpdateOneID(userIDs[2]).
		SetDeletedAt(time.Now().UTC()).Exec(ctx))
	members, result, err := repo.List(ctx, organization.ID, pagination.DefaultPagination(), service.OrganizationMemberListFilters{})
	require.NoError(t, err)
	require.EqualValues(t, len(userIDs)-1, result.Total)
	for _, member := range members {
		require.NotEqual(t, userIDs[2], member.UserID)
	}
}

func TestOrganizationMemberRepositorySetsSpendingLimitsAtomically(t *testing.T) {
	ctx := context.Background()
	organization, userIDs := seedOrganizationWithMembers(t, ctx, 2)
	repo := NewOrganizationMemberRepository(integrationEntClient)

	limit := 30.5
	require.NoError(t, repo.SetSpendingLimits(ctx, organization.ID, []service.OrganizationMemberSpendingLimit{
		{UserID: userIDs[1], Limit: &limit},
	}))
	member, err := repo.Get(ctx, organization.ID, userIDs[1])
	require.NoError(t, err)
	require.NotNil(t, member.SpendingLimit)
	require.InDelta(t, limit, *member.SpendingLimit, 0)

	// 0 表示完全不能消费，与不限额不同。
	zero := 0.0
	require.NoError(t, repo.SetSpendingLimits(ctx, organization.ID, []service.OrganizationMemberSpendingLimit{
		{UserID: userIDs[1], Limit: &zero},
	}))
	member, err = repo.Get(ctx, organization.ID, userIDs[1])
	require.NoError(t, err)
	require.NotNil(t, member.SpendingLimit)
	require.Zero(t, *member.SpendingLimit)

	// 传空改回不限额。
	require.NoError(t, repo.SetSpendingLimits(ctx, organization.ID, []service.OrganizationMemberSpendingLimit{
		{UserID: userIDs[1], Limit: nil},
	}))
	member, err = repo.Get(ctx, organization.ID, userIDs[1])
	require.NoError(t, err)
	require.Nil(t, member.SpendingLimit)

	// 批量写入里出现非本组织成员时，整批都不生效。
	batchLimit := 12.0
	err = repo.SetSpendingLimits(ctx, organization.ID, []service.OrganizationMemberSpendingLimit{
		{UserID: userIDs[1], Limit: &batchLimit},
		{UserID: 0, Limit: &batchLimit},
	})
	require.True(t, errors.Is(err, service.ErrOrganizationMemberNotFound))
	member, err = repo.Get(ctx, organization.ID, userIDs[1])
	require.NoError(t, err)
	require.Nil(t, member.SpendingLimit, "整批失败后不能留下部分写入")
}
