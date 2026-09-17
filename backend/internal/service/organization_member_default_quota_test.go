package service

import (
	"context"
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestOrganizationDefaultQuotaValidation(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()

	// 非法金额与周期在开启时被拒绝。
	for _, update := range []OrganizationDefaultQuotaUpdate{
		{Enabled: true, Amount: -1, PeriodDays: 30},
		{Enabled: true, Amount: math.NaN(), PeriodDays: 30},
		{Enabled: true, Amount: 20, PeriodDays: 0},
		{Enabled: true, Amount: 20, PeriodDays: QuotaMaxPeriodDays + 1},
	} {
		_, err := fixture.service.UpdateDefaultQuota(ctx, testOrganizationOwnerID, update)
		if update.PeriodDays == 0 || update.PeriodDays > QuotaMaxPeriodDays {
			require.ErrorIs(t, err, ErrOrganizationQuotaPeriodInvalid)
		} else {
			require.ErrorIs(t, err, ErrOrganizationQuotaAmountInvalid)
		}
	}

	// 正常开启：金额按 8 位小数取整落进配置。
	synced, err := fixture.service.UpdateDefaultQuota(ctx, testOrganizationOwnerID,
		OrganizationDefaultQuotaUpdate{Enabled: true, Amount: 20, PeriodDays: 30})
	require.NoError(t, err)
	require.True(t, synced.Quota.Enabled)
	require.NotNil(t, synced.Quota.Amount)
	require.Equal(t, QuantizeUsageBillingAmount(20), *synced.Quota.Amount)
	require.NotNil(t, synced.Quota.PeriodDays)
	require.Equal(t, 30, *synced.Quota.PeriodDays)

	// 关闭即清空配置，同步开关一并归零，不碰任何成员。
	synced, err = fixture.service.UpdateDefaultQuota(ctx, testOrganizationOwnerID,
		OrganizationDefaultQuotaUpdate{Enabled: false, SyncConfigured: true, SyncUnconfigured: true})
	require.NoError(t, err)
	require.False(t, synced.Quota.Enabled)
	require.Nil(t, synced.Quota.Amount)
	require.Nil(t, synced.Quota.PeriodDays)
	require.Empty(t, synced.SyncedUserIDs)

	// 只有组织创建者能读默认配额。
	_, err = fixture.service.GetDefaultQuota(ctx, testOrganizationMemberID)
	require.Error(t, err)
}

func TestOrganizationDefaultQuotaSyncMatrix(t *testing.T) {
	// 统一初始状态：成员 2 已有生效中的周期配额（100/30，已用 40、加成 5），
	// 成员 3、4 没配周期配额，创建者 1 永远是旁观者。
	setup := func(t *testing.T) *organizationMemberFixture {
		t.Helper()
		fixture := newOrganizationMemberFixture(t)
		member := fixture.members.members[testOrganizationMemberID]
		quotaStart := time.Now().Add(-time.Hour)
		member.QuotaAmount = spendingLimitPtr(100)
		member.QuotaPeriodDays = intPtr(30)
		member.QuotaStartAt = &quotaStart
		member.QuotaCycleStart = &quotaStart
		member.QuotaCycleBonus = 5
		member.SpendingUsed = 40
		return fixture
	}

	t.Run("两个开关都不勾：只存配置，存量一个不动", func(t *testing.T) {
		fixture := setup(t)
		synced, err := fixture.service.UpdateDefaultQuota(context.Background(), testOrganizationOwnerID,
			OrganizationDefaultQuotaUpdate{Enabled: true, Amount: 20, PeriodDays: 30})
		require.NoError(t, err)
		require.Empty(t, synced.SyncedUserIDs)

		// 成员 2 原有的周期配额保持原样，没配的成员继续没配。
		untouched := fixture.members.members[testOrganizationMemberID]
		require.NotNil(t, untouched.QuotaAmount)
		require.Equal(t, 100.0, *untouched.QuotaAmount)
		require.Nil(t, fixture.members.members[testOrganizationOtherID].QuotaAmount)
		require.Nil(t, fixture.members.members[testOrganizationAdminID].QuotaAmount)
		require.Empty(t, fixture.authCache.invalidatedUserIDs)
	})

	t.Run("只勾补空白：没配的拿到配额，已配的不动", func(t *testing.T) {
		fixture := setup(t)
		synced, err := fixture.service.UpdateDefaultQuota(context.Background(), testOrganizationOwnerID,
			OrganizationDefaultQuotaUpdate{Enabled: true, Amount: 20, PeriodDays: 30, SyncUnconfigured: true})
		require.NoError(t, err)
		require.Equal(t, []int64{testOrganizationOtherID, testOrganizationAdminID}, synced.SyncedUserIDs)

		for _, userID := range synced.SyncedUserIDs {
			member := fixture.members.members[userID]
			require.NotNil(t, member.QuotaAmount)
			require.Equal(t, 20.0, *member.QuotaAmount)
			require.Equal(t, 30, *member.QuotaPeriodDays)
			require.NotNil(t, member.QuotaCycleStart)
			require.Equal(t, 0.0, member.SpendingUsed)
		}

		untouched := fixture.members.members[testOrganizationMemberID]
		require.NotNil(t, untouched.QuotaAmount)
		require.Equal(t, 100.0, *untouched.QuotaAmount)
		require.Equal(t, 40.0, untouched.SpendingUsed)
		require.Nil(t, fixture.members.members[testOrganizationOwnerID].QuotaAmount)
	})

	t.Run("只勾覆盖已配：已配的当场重置，没配的不动", func(t *testing.T) {
		fixture := setup(t)
		synced, err := fixture.service.UpdateDefaultQuota(context.Background(), testOrganizationOwnerID,
			OrganizationDefaultQuotaUpdate{Enabled: true, Amount: 20, PeriodDays: 30, SyncConfigured: true})
		require.NoError(t, err)
		require.Equal(t, []int64{testOrganizationMemberID}, synced.SyncedUserIDs)

		reset := fixture.members.members[testOrganizationMemberID]
		require.NotNil(t, reset.QuotaAmount)
		require.Equal(t, 20.0, *reset.QuotaAmount)
		require.Equal(t, 0.0, reset.SpendingUsed)
		require.Equal(t, 0.0, reset.QuotaCycleBonus)

		require.Nil(t, fixture.members.members[testOrganizationOtherID].QuotaAmount)
		require.Nil(t, fixture.members.members[testOrganizationAdminID].QuotaAmount)
	})

	t.Run("两个都勾：全员统一换新，创建者除外", func(t *testing.T) {
		fixture := setup(t)
		synced, err := fixture.service.UpdateDefaultQuota(context.Background(), testOrganizationOwnerID,
			OrganizationDefaultQuotaUpdate{
				Enabled:          true,
				Amount:           20,
				PeriodDays:       30,
				SyncUnconfigured: true,
				SyncConfigured:   true,
			})
		require.NoError(t, err)
		require.Equal(t,
			[]int64{testOrganizationMemberID, testOrganizationOtherID, testOrganizationAdminID},
			synced.SyncedUserIDs)

		for _, userID := range synced.SyncedUserIDs {
			member := fixture.members.members[userID]
			require.NotNil(t, member.QuotaAmount)
			require.Equal(t, 20.0, *member.QuotaAmount)
		}
		require.Nil(t, fixture.members.members[testOrganizationOwnerID].QuotaAmount)

		// 换新过的成员要清鉴权缓存，额度变化立刻对调用侧可见。
		require.ElementsMatch(t, synced.SyncedUserIDs, fixture.authCache.invalidatedUserIDs)

		config, err := fixture.service.GetDefaultQuota(context.Background(), testOrganizationOwnerID)
		require.NoError(t, err)
		require.True(t, config.Enabled)
	})
}

func TestJoinDefaultQuotaCopy(t *testing.T) {
	// 未开启默认配额：不入周期模式。
	off := &Organization{Name: "Acme", OwnerUserID: 1}
	_, _, ok := joinDefaultQuotaCopy(off, time.Now())
	require.False(t, ok)

	// 数据不完整的配置按未开启处理，防御数据库约束之外的脏数据。
	broken := &Organization{
		Name: "Acme", OwnerUserID: 1,
		DefaultQuotaEnabled: true, DefaultQuotaAmount: spendingLimitPtr(20),
	}
	_, _, ok = joinDefaultQuotaCopy(broken, time.Now())
	require.False(t, ok)

	// 开启后：周期从加入时刻起算，第一期当场开始。
	joinedAt := time.Now()
	org := &Organization{
		Name: "Acme", OwnerUserID: 1,
		DefaultQuotaEnabled:    true,
		DefaultQuotaAmount:     spendingLimitPtr(20),
		DefaultQuotaPeriodDays: intPtr(30),
	}
	quota, cycleStart, ok := joinDefaultQuotaCopy(org, joinedAt)
	require.True(t, ok)
	require.Equal(t, 20.0, quota.Amount)
	require.Equal(t, 30, quota.PeriodDays)
	require.True(t, quota.StartAt.Equal(joinedAt))
	require.True(t, cycleStart.Equal(joinedAt))
}

func TestOrganizationCompleteJoinCopiesDefaultQuota(t *testing.T) {
	ctx := context.Background()
	organizationRepo := newOrganizationRepoStub()
	amount := 20.0
	periodDays := 30
	organization := &Organization{
		Name:                   "Acme",
		OwnerUserID:            100,
		DefaultQuotaEnabled:    true,
		DefaultQuotaAmount:     &amount,
		DefaultQuotaPeriodDays: &periodDays,
	}
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
	orgService := NewOrganizationService(organizationRepo, redeemRepo)

	intent, err := orgService.ResolveRegistrationIntent(ctx, "", "新同事", "ORG", false)
	require.NoError(t, err)
	_, err = orgService.CompleteRegistration(ctx, 101, intent)
	require.NoError(t, err)

	membership, err := organizationRepo.GetMembershipByUserID(ctx, 101)
	require.NoError(t, err)
	require.NotNil(t, membership.QuotaAmount)
	require.Equal(t, 20.0, *membership.QuotaAmount)
	require.NotNil(t, membership.QuotaPeriodDays)
	require.Equal(t, 30, *membership.QuotaPeriodDays)
	require.NotNil(t, membership.QuotaStartAt)
	require.NotNil(t, membership.QuotaCycleStart)
	// 周期从加入时刻起算：当期起点与锚点一致。
	require.True(t, membership.QuotaCycleStart.Equal(*membership.QuotaStartAt))
}
