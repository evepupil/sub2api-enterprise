//go:build integration

package repository

import (
	"context"
	"testing"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/organizationmember"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func requireDefaultQuotaEcho(
	t *testing.T,
	result *service.OrganizationDefaultQuotaSynced,
	enabled bool,
	amount *float64,
	periodDays *int,
) {
	t.Helper()
	require.NotNil(t, result)
	require.Equal(t, enabled, result.Quota.Enabled)
	if amount == nil {
		require.Nil(t, result.Quota.Amount)
	} else {
		require.NotNil(t, result.Quota.Amount)
		require.Equal(t, *amount, *result.Quota.Amount)
	}
	if periodDays == nil {
		require.Nil(t, result.Quota.PeriodDays)
	} else {
		require.NotNil(t, result.Quota.PeriodDays)
		require.Equal(t, *periodDays, *result.Quota.PeriodDays)
	}
}

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
	enabledAmount := 20.0
	enabledPeriodDays := 30
	requireDefaultQuotaEcho(t, synced, true, &enabledAmount, &enabledPeriodDays)
	require.Empty(t, synced.SyncedUserIDs)
	config, err = repo.GetDefaultQuota(ctx, organization.ID)
	require.NoError(t, err)
	require.True(t, config.Enabled)
	require.NotNil(t, config.Amount)
	require.Equal(t, 20.0, *config.Amount)

	// 只勾覆盖已配：成员当场换新一期（金额 20、已用清零），创建者不受影响。
	now := time.Now()
	changedAmount := 25.0
	changedPeriodDays := 15
	synced, err = repo.UpdateDefaultQuota(ctx, organization.ID, service.OrganizationDefaultQuotaUpdate{
		Enabled: true, Amount: changedAmount, PeriodDays: changedPeriodDays, SyncConfigured: true,
	})
	require.NoError(t, err)
	requireDefaultQuotaEcho(t, synced, true, &changedAmount, &changedPeriodDays)
	require.Equal(t, []int64{memberID}, synced.SyncedUserIDs)
	member, err := repo.Get(ctx, organization.ID, memberID)
	require.NoError(t, err)
	require.NotNil(t, member.QuotaAmount)
	require.Equal(t, changedAmount, *member.QuotaAmount)
	require.Zero(t, member.SpendingUsed)
	require.NotNil(t, member.QuotaCycleStart)
	require.LessOrEqual(t, member.QuotaCycleStart.Sub(now), time.Second)
	owner, err := repo.Get(ctx, organization.ID, ownerID)
	require.NoError(t, err)
	require.Nil(t, owner.QuotaAmount)
	config, err = repo.GetDefaultQuota(ctx, organization.ID)
	require.NoError(t, err)
	require.NotNil(t, config.Amount)
	require.Equal(t, changedAmount, *config.Amount)
	require.NotNil(t, config.PeriodDays)
	require.Equal(t, changedPeriodDays, *config.PeriodDays)

	// 关闭配置：组织行清空，成员已抄到的配额保留。
	synced, err = repo.UpdateDefaultQuota(ctx, organization.ID, service.OrganizationDefaultQuotaUpdate{})
	require.NoError(t, err)
	requireDefaultQuotaEcho(t, synced, false, nil, nil)
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
	ownerID, memberID, unconfiguredMemberID := userIDs[0], userIDs[1], userIDs[2]

	past := time.Now().Add(-2 * time.Hour).UTC().Truncate(time.Second)
	setMemberPeriodicQuota(t, ctx, memberID, 100, 30, past, &past)

	amount := 20.0
	periodDays := 30
	synced, err := repo.UpdateDefaultQuota(ctx, organization.ID, service.OrganizationDefaultQuotaUpdate{
		Enabled: true, Amount: amount, PeriodDays: periodDays, SyncUnconfigured: true,
	})
	require.NoError(t, err)
	requireDefaultQuotaEcho(t, synced, true, &amount, &periodDays)
	require.Equal(t, []int64{unconfiguredMemberID}, synced.SyncedUserIDs)

	owner, err := repo.Get(ctx, organization.ID, ownerID)
	require.NoError(t, err)
	require.Nil(t, owner.QuotaAmount)

	member, err := repo.Get(ctx, organization.ID, memberID)
	require.NoError(t, err)
	require.NotNil(t, member.QuotaAmount)
	require.Equal(t, 100.0, *member.QuotaAmount)
	require.NotNil(t, member.SpendingUsed)

	unconfiguredMember, err := repo.Get(ctx, organization.ID, unconfiguredMemberID)
	require.NoError(t, err)
	require.NotNil(t, unconfiguredMember.QuotaAmount)
	require.Equal(t, amount, *unconfiguredMember.QuotaAmount)
}

// 已有外层 Ent 事务时，组织默认额度的返回值与事务内回读都应保持一致。
func TestUpdateDefaultQuotaReturnsQuotaInOuterTransaction(t *testing.T) {
	ctx := context.Background()
	organization, _ := seedOrganizationWithMembers(t, ctx, 1)
	repo := NewOrganizationMemberRepository(integrationEntClient)
	tx := testEntTx(t)
	txCtx := dbent.NewTxContext(ctx, tx)

	amount := 12.0
	periodDays := 14
	synced, err := repo.UpdateDefaultQuota(txCtx, organization.ID, service.OrganizationDefaultQuotaUpdate{
		Enabled: true, Amount: amount, PeriodDays: periodDays,
	})
	require.NoError(t, err)
	requireDefaultQuotaEcho(t, synced, true, &amount, &periodDays)

	config, err := repo.GetDefaultQuota(txCtx, organization.ID)
	require.NoError(t, err)
	require.True(t, config.Enabled)
	require.NotNil(t, config.Amount)
	require.Equal(t, amount, *config.Amount)
	require.NotNil(t, config.PeriodDays)
	require.Equal(t, periodDays, *config.PeriodDays)

	synced, err = repo.UpdateDefaultQuota(txCtx, organization.ID, service.OrganizationDefaultQuotaUpdate{})
	require.NoError(t, err)
	requireDefaultQuotaEcho(t, synced, false, nil, nil)

	config, err = repo.GetDefaultQuota(txCtx, organization.ID)
	require.NoError(t, err)
	require.False(t, config.Enabled)
	require.Nil(t, config.Amount)
	require.Nil(t, config.PeriodDays)
}
