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

// setMemberPeriodicQuota 直接落一条周期配额配置，供集成用例构造各种时间状态。
func setMemberPeriodicQuota(
	t *testing.T,
	ctx context.Context,
	userID int64,
	amount float64,
	periodDays int,
	startAt time.Time,
	cycleStart *time.Time,
) {
	t.Helper()
	update := testEntClient(t).OrganizationMember.Update().
		Where( /* 按成员标识定位 */ organizationmember.UserIDEQ(userID)).
		SetQuotaAmount(amount).
		SetQuotaPeriodDays(periodDays).
		SetQuotaStartAt(startAt)
	if cycleStart != nil {
		update = update.SetQuotaCycleStart(*cycleStart)
	} else {
		update = update.ClearQuotaCycleStart()
	}
	affected, err := update.Save(ctx)
	require.NoError(t, err)
	require.EqualValues(t, 1, affected)
}

func TestSetPeriodicQuotasWritesAllModesAtomically(t *testing.T) {
	ctx := context.Background()
	organization, userIDs := seedOrganizationWithMembers(t, ctx, 2)
	repo := NewOrganizationMemberRepository(integrationEntClient)
	memberID := userIDs[1]

	// 锚点已到：第一期立刻开始。
	now := time.Now()
	past := now.Add(-2 * time.Hour)
	require.NoError(t, repo.SetPeriodicQuotas(ctx, organization.ID, []service.OrganizationMemberQuotaWrite{
		{
			UserID:     memberID,
			Quota:      &service.PeriodicQuotaInput{Amount: 100, PeriodDays: 30, StartAt: past},
			CycleStart: &past,
			ResetUsed:  true,
		},
	}))
	member, err := repo.Get(ctx, organization.ID, memberID)
	require.NoError(t, err)
	require.NotNil(t, member.QuotaCycleStart)
	// Postgres 的时间列到微秒精度，纳秒尾巴写库即截断，按秒级容差比较。
	require.LessOrEqual(t, member.QuotaCycleStart.Sub(past), time.Second)
	require.GreaterOrEqual(t, member.QuotaCycleStart.Sub(past), -time.Second)

	// 锚点在未来：未生效，当期起点留空。
	future := now.Add(48 * time.Hour)
	require.NoError(t, repo.SetPeriodicQuotas(ctx, organization.ID, []service.OrganizationMemberQuotaWrite{
		{
			UserID:    memberID,
			Quota:     &service.PeriodicQuotaInput{Amount: 100, PeriodDays: 30, StartAt: future},
			ResetUsed: false,
		},
	}))
	member, err = repo.Get(ctx, organization.ID, memberID)
	require.NoError(t, err)
	require.Nil(t, member.QuotaCycleStart)

	// 取消周期：四列清空，静态上限保留。
	require.NoError(t, repo.SetPeriodicQuotas(ctx, organization.ID, []service.OrganizationMemberQuotaWrite{
		{UserID: memberID},
	}))
	member, err = repo.Get(ctx, organization.ID, memberID)
	require.NoError(t, err)
	require.Nil(t, member.QuotaAmount)
	require.Nil(t, member.QuotaPeriodDays)
	require.Nil(t, member.QuotaStartAt)
	require.Nil(t, member.QuotaCycleStart)

	// 批量里出现不存在的成员时整批拒绝。
	require.Error(t, repo.SetPeriodicQuotas(ctx, organization.ID, []service.OrganizationMemberQuotaWrite{
		{
			UserID:    memberID,
			Quota:     &service.PeriodicQuotaInput{Amount: 1, PeriodDays: 1, StartAt: future},
			ResetUsed: false,
		},
		{UserID: 0},
	}))
	member, err = repo.Get(ctx, organization.ID, memberID)
	require.NoError(t, err)
	require.Nil(t, member.QuotaAmount, "整批失败后不能留下部分写入")
}

func TestAdvanceDueQuotaRollsCycleAndClearsUsed(t *testing.T) {
	ctx := context.Background()
	_, userIDs := seedOrganizationWithMembers(t, ctx, 1)
	repo := NewOrganizationMemberRepository(integrationEntClient)
	memberID := userIDs[1]

	// 一天周期，锚点和当期起点都在三天前，已用带着旧周期的数字。
	anchor := time.Now().Add(-72 * time.Hour).UTC().Truncate(time.Second)
	setMemberPeriodicQuota(t, ctx, memberID, 40, 1, anchor, &anchor)
	_, err := integrationEntClient.OrganizationMember.Update().
		Where(organizationmember.UserIDEQ(memberID)).
		SetSpendingUsed(39).
		Save(ctx)
	require.NoError(t, err)

	advanced, err := repo.AdvanceDueQuota(ctx, memberID, time.Now())
	require.NoError(t, err)
	require.NotNil(t, advanced)
	require.True(t, advanced.QuotaCycleStart.After(anchor), "当期起点应推进到当前期")
	require.Zero(t, advanced.SpendingUsed)

	// 已推进的行再推进是无操作。
	again, err := repo.AdvanceDueQuota(ctx, memberID, time.Now())
	require.NoError(t, err)
	require.Nil(t, again)

	// 未生效（锚点在未来）的行不推进。
	setMemberPeriodicQuota(t, ctx, memberID, 40, 1, time.Now().Add(time.Hour), nil)
	again, err = repo.AdvanceDueQuota(ctx, memberID, time.Now())
	require.NoError(t, err)
	require.Nil(t, again)
}

func TestGetMemberSpendingAdvancesAndReturnsWindowEnd(t *testing.T) {
	ctx := context.Background()
	_, userIDs := seedOrganizationWithMembers(t, ctx, 1)
	memberID := userIDs[1]

	anchor := time.Now().Add(-48 * time.Hour).UTC().Truncate(time.Second)
	setMemberPeriodicQuota(t, ctx, memberID, 40, 1, anchor, &anchor)
	_, err := integrationEntClient.OrganizationMember.Update().
		Where(organizationmember.UserIDEQ(memberID)).
		SetSpendingUsed(39).
		SetSpendingFrozen(0).
		Save(ctx)
	require.NoError(t, err)

	repo := NewOrganizationSpendingRepository(integrationEntClient)
	spending, windowEnd, err := repo.GetMemberSpending(ctx, memberID)
	require.NoError(t, err)
	require.InDelta(t, 0, spending, 0.000001, "回源前先推进，已用清零")
	require.NotNil(t, windowEnd)
	require.True(t, windowEnd.After(time.Now()), "本期截止在未来")
	require.True(t, windowEnd.Sub(time.Now()) <= 24*time.Hour, "一天周期的截止不超过一天")
}

func TestBatchImageHoldFollowsPeriodicQuota(t *testing.T) {
	ctx := context.Background()

	t.Run("生效中的每期金额管住预扣", func(t *testing.T) {
		fixture := seedOrganizationBilling(t, ctx, 100)
		setMemberPeriodicQuota(t, ctx, fixture.member.ID, 5, 30, time.Now().Add(-time.Hour), timePtr(time.Now().Add(-time.Hour)))
		repo := NewUsageBillingRepository(testEntClient(t), integrationDB)
		batchID := "batch-" + time.Now().Format("150405.000000000")

		_, err := repo.ReserveBatchImageBalance(ctx, &service.BatchImageBalanceHoldCommand{
			RequestID:  service.BatchImageHoldRequestID(batchID),
			APIKeyID:   fixture.apiKey.ID,
			UserID:     fixture.member.ID,
			BatchID:    batchID,
			HoldAmount: 10,
		})
		require.Error(t, err, "预扣超过每期金额应被拒绝")
	})

	t.Run("换期后额度恢复预扣放行", func(t *testing.T) {
		fixture := seedOrganizationBilling(t, ctx, 100)
		// 一天周期，当期起点停在两天前：预扣判断会先推进周期、清掉旧已用。
		anchor := time.Now().Add(-48 * time.Hour).UTC().Truncate(time.Second)
		setMemberPeriodicQuota(t, ctx, fixture.member.ID, 5, 1, anchor, &anchor)
		_, err := testEntClient(t).OrganizationMember.Update().
			Where(organizationmember.UserIDEQ(fixture.member.ID)).
			SetSpendingUsed(5).
			Save(ctx)
		require.NoError(t, err)

		repo := NewUsageBillingRepository(testEntClient(t), integrationDB)
		batchID := "batch-" + time.Now().Format("150405.000000000")
		_, err = repo.ReserveBatchImageBalance(ctx, &service.BatchImageBalanceHoldCommand{
			RequestID:  service.BatchImageHoldRequestID(batchID),
			APIKeyID:   fixture.apiKey.ID,
			UserID:     fixture.member.ID,
			BatchID:    batchID,
			HoldAmount: 5,
		})
		require.NoError(t, err, "换期后每期金额恢复，预扣应放行")

		member, err := integrationEntClient.OrganizationMember.Query().
			Where(organizationmember.UserIDEQ(fixture.member.ID)).Only(ctx)
		require.NoError(t, err)
		require.True(t, member.QuotaCycleStart.After(anchor), "预扣路径应已把当期起点推进")
	})

	t.Run("未生效前沿用静态上限", func(t *testing.T) {
		fixture := seedOrganizationBilling(t, ctx, 100)
		setMemberSpendingLimit(t, ctx, fixture.member.ID, 20)
		setMemberPeriodicQuota(t, ctx, fixture.member.ID, 5, 30, time.Now().Add(24*time.Hour), nil)
		repo := NewUsageBillingRepository(testEntClient(t), integrationDB)
		batchID := "batch-" + time.Now().Format("150405.000000000")

		_, err := repo.ReserveBatchImageBalance(ctx, &service.BatchImageBalanceHoldCommand{
			RequestID:  service.BatchImageHoldRequestID(batchID),
			APIKeyID:   fixture.apiKey.ID,
			UserID:     fixture.member.ID,
			BatchID:    batchID,
			HoldAmount: 10,
		})
		require.NoError(t, err, "锚点未到，按静态上限 20 判断应放行")
	})
}

func timePtr(value time.Time) *time.Time { return &value }
