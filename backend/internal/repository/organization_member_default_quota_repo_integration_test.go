//go:build integration

package repository

import (
	"context"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/ent/organizationmember"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

// 组织默认周期配额的落库路径：配置写入 + 按开关同步存量成员，必须同一事务生效。
func TestUpdateDefaultQuotaSavesConfigAndSyncsMembers(t *testing.T) {
	ctx := context.Background()
	organization, userIDs := seedOrganizationWithMembers(t, ctx, 2)
	repo := NewOrganizationMemberRepository(integrationEntClient)
	ownerID, memberID := userIDs[0], userIDs[1]

	// 初始：成员已带一份周期配额（100/30，已用 40），组织配置为空。
	past := time.Now().Add(-2 * time.Hour).UTC().Truncate(time.Second)
	setMemberPeriodicQuota(t, ctx, memberID, 100, 30, past, &past)
	_, err := integrationEntClient.OrganizationMember.Update().
		Where(organizationmember.UserIDEQ(memberID)).
		SetSpendingUsed(40).
		Save(ctx)
	require.NoError(t, err)

	config, err := repo.GetDefaultQuota(ctx, organization.ID)
	require.NoError(t, err)
	require.False(t, config.Enabled)

	// 两个开关都不勾：只存配置，成员不动。
	synced, err := repo.UpdateDefaultQuota(ctx, organization.ID, service.OrganizationDefaultQuotaUpdate{
		Enabled: true, Amount: 20, PeriodDays: 30,
	})
	require.NoError(t, err)
	require.Empty(t, synced.SyncedUserIDs)
	config, err = repo.GetDefaultQuota(ctx, organization.ID)
	require.NoError(t, err)
	require.True(t, config.Enabled)
	require.NotNil(t, config.Amount)
	require.Equal(t, 20.0, *config.Amount)

	// 只勾覆盖已配：成员当场换新一期（金额 20、已用清零），创建者不受影响。
	now := time.Now()
	synced, err = repo.UpdateDefaultQuota(ctx, organization.ID, service.OrganizationDefaultQuotaUpdate{
		Enabled: true, Amount: 20, PeriodDays: 30, SyncConfigured: true,
	})
	require.NoError(t, err)
	require.Equal(t, []int64{memberID}, synced.SyncedUserIDs)
	member, err := repo.Get(ctx, organization.ID, memberID)
	require.NoError(t, err)
	require.NotNil(t, member.QuotaAmount)
	require.Equal(t, 20.0, *member.QuotaAmount)
	require.Zero(t, member.SpendingUsed)
	require.NotNil(t, member.QuotaCycleStart)
	require.LessOrEqual(t, member.QuotaCycleStart.Sub(now), time.Second)
	owner, err := repo.Get(ctx, organization.ID, ownerID)
	require.NoError(t, err)
	require.Nil(t, owner.QuotaAmount)

	// 关闭配置：组织行清空，成员已抄到的配额保留。
	_, err = repo.UpdateDefaultQuota(ctx, organization.ID, service.OrganizationDefaultQuotaUpdate{})
	require.NoError(t, err)
	config, err = repo.GetDefaultQuota(ctx, organization.ID)
	require.NoError(t, err)
	require.False(t, config.Enabled)
	require.Nil(t, config.Amount)
	member, err = repo.Get(ctx, organization.ID, memberID)
	require.NoError(t, err)
	require.NotNil(t, member.QuotaAmount)
}

// 只勾补空白：没配的成员拿到配额并立即生效，已配的保持不动。
func TestUpdateDefaultQuotaSyncsOnlyUnconfiguredMembers(t *testing.T) {
	ctx := context.Background()
	organization, userIDs := seedOrganizationWithMembers(t, ctx, 2)
	repo := NewOrganizationMemberRepository(integrationEntClient)
	ownerID, memberID := userIDs[0], userIDs[1]

	past := time.Now().Add(-2 * time.Hour).UTC().Truncate(time.Second)
	setMemberPeriodicQuota(t, ctx, memberID, 100, 30, past, &past)

	synced, err := repo.UpdateDefaultQuota(ctx, organization.ID, service.OrganizationDefaultQuotaUpdate{
		Enabled: true, Amount: 20, PeriodDays: 30, SyncUnconfigured: true,
	})
	require.NoError(t, err)
	require.Equal(t, []int64{ownerID}, synced.SyncedUserIDs)

	owner, err := repo.Get(ctx, organization.ID, ownerID)
	require.NoError(t, err)
	require.NotNil(t, owner.QuotaAmount)
	require.Equal(t, 20.0, *owner.QuotaAmount)

	member, err := repo.Get(ctx, organization.ID, memberID)
	require.NoError(t, err)
	require.NotNil(t, member.QuotaAmount)
	require.Equal(t, 100.0, *member.QuotaAmount)
	require.NotNil(t, member.SpendingUsed)
}
