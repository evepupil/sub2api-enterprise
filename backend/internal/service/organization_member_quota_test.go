package service

import (
	"context"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"

	"github.com/stretchr/testify/require"
)

func quotaDay(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func TestAlignQuotaCycleStart(t *testing.T) {
	anchor := time.Date(2026, 9, 1, 8, 0, 0, 0, time.UTC)
	day := 24 * time.Hour
	cases := []struct {
		name       string
		periodDays int
		offset     time.Duration
		want       time.Time
	}{
		{"锚点之前不动", 30, -time.Hour, anchor},
		{"第一期内不动", 30, 29 * day, anchor},
		{"压线差一秒不推", 30, 30*day - time.Second, anchor},
		{"正好到期推一期", 30, 30 * day, anchor.Add(30 * day)},
		{"过一期推一期", 30, 31 * day, anchor.Add(30 * day)},
		{"跨三期一步到位", 30, 95 * day, anchor.Add(90 * day)},
		{"一天周期逐日推进", 1, 2*day + time.Hour, anchor.Add(2 * day)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := AlignQuotaCycleStart(anchor, tc.periodDays, anchor.Add(tc.offset))
			require.True(t, got.Equal(tc.want))
		})
	}
}

func TestResolveMemberQuotaState(t *testing.T) {
	anchor := time.Date(2026, 9, 1, 8, 0, 0, 0, time.UTC)
	day := 24 * time.Hour
	amount := 100.0
	periodDays := 30
	cycleStart := anchor

	mustPtr := spendingLimitPtr

	t.Run("未配置周期走静态", func(t *testing.T) {
		state := ResolveMemberQuotaState(nil, nil, nil, nil, anchor)
		require.Equal(t, QuotaModeStatic, state.Mode)
		require.False(t, state.NeedsAdvance)
	})

	t.Run("锚点在未来是未生效", func(t *testing.T) {
		state := ResolveMemberQuotaState(mustPtr(amount), &periodDays, &anchor, nil, anchor.Add(-time.Minute))
		require.Equal(t, QuotaModePending, state.Mode)
		require.False(t, state.NeedsAdvance)
		require.Nil(t, state.CycleStart)
		require.Nil(t, state.WindowEnd)
	})

	t.Run("越过锚点即激活且必须落库清零", func(t *testing.T) {
		// 当期起点为空 + 已越过锚点：即使还在第一期内，激活本身也是一次推进，
		// 静态时期攒下的已消费不能带进第一期。
		state := ResolveMemberQuotaState(mustPtr(amount), &periodDays, &anchor, nil, anchor.Add(time.Hour))
		require.Equal(t, QuotaModeActive, state.Mode)
		require.True(t, state.NeedsAdvance)
		require.True(t, state.CycleStart.Equal(anchor))
		require.True(t, state.WindowEnd.Equal(anchor.Add(30*day)))
	})

	t.Run("生效中未到期不推进", func(t *testing.T) {
		state := ResolveMemberQuotaState(mustPtr(amount), &periodDays, &anchor, &cycleStart, anchor.Add(29*day))
		require.Equal(t, QuotaModeActive, state.Mode)
		require.False(t, state.NeedsAdvance)
		require.True(t, state.CycleStart.Equal(anchor))
	})

	t.Run("到期换期要推进", func(t *testing.T) {
		state := ResolveMemberQuotaState(mustPtr(amount), &periodDays, &anchor, &cycleStart, anchor.Add(61*day))
		require.Equal(t, QuotaModeActive, state.Mode)
		require.True(t, state.NeedsAdvance)
		require.True(t, state.CycleStart.Equal(anchor.Add(60*day)))
		require.True(t, state.WindowEnd.Equal(anchor.Add(90*day)))
	})
}

func TestOrganizationMemberEffectiveLimitAndRemaining(t *testing.T) {
	now := time.Now()
	amount := 50.0
	periodDays := 7

	t.Run("周期生效中按每期金额执行", func(t *testing.T) {
		cycleStart := now.Add(-2 * 24 * time.Hour)
		member := &OrganizationMember{
			SpendingLimit:   spendingLimitPtr(999),
			SpendingUsed:    10,
			SpendingFrozen:  5,
			QuotaAmount:     &amount,
			QuotaPeriodDays: &periodDays,
			QuotaStartAt:    &cycleStart,
			QuotaCycleStart: &cycleStart,
		}
		require.Equal(t, 50.0, *member.EffectiveSpendingLimit(now))
		remaining := member.SpendingRemainingAt(now)
		require.NotNil(t, remaining)
		require.Equal(t, 35.0, *remaining)
	})

	t.Run("周期生效中一次性加成加进生效上限", func(t *testing.T) {
		cycleStart := now.Add(-2 * 24 * time.Hour)
		member := &OrganizationMember{
			SpendingUsed:    10,
			QuotaAmount:     &amount,
			QuotaPeriodDays: &periodDays,
			QuotaStartAt:    &cycleStart,
			QuotaCycleStart: &cycleStart,
			QuotaCycleBonus: 8,
		}
		require.Equal(t, 58.0, *member.EffectiveSpendingLimit(now))
		require.Equal(t, 48.0, *member.SpendingRemainingAt(now))
	})

	t.Run("未生效前沿用静态上限", func(t *testing.T) {
		future := now.Add(24 * time.Hour)
		staticLimit := 123.0
		member := &OrganizationMember{
			SpendingLimit:   &staticLimit,
			SpendingUsed:    3,
			QuotaAmount:     &amount,
			QuotaPeriodDays: &periodDays,
			QuotaStartAt:    &future,
		}
		require.Equal(t, &staticLimit, member.EffectiveSpendingLimit(now))
	})

	t.Run("没配周期时静态留空即不限额", func(t *testing.T) {
		member := &OrganizationMember{SpendingUsed: 8}
		require.Nil(t, member.EffectiveSpendingLimit(now))
		require.Nil(t, member.SpendingRemainingAt(now))
	})
}

func TestOrganizationMemberServiceUpdateQuota(t *testing.T) {
	t.Run("现在开始第一期立刻生效并清已用", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		ctx := context.Background()
		fixture.members.members[testOrganizationMemberID].SpendingUsed = 42

		member, err := fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, testOrganizationMemberID, &PeriodicQuotaInput{
			Amount:     100,
			PeriodDays: 30,
			StartAt:    time.Now().Add(-time.Minute),
		})
		require.NoError(t, err)
		require.NotNil(t, member.QuotaAmount)
		require.Equal(t, 100.0, *member.QuotaAmount)
		require.NotNil(t, member.QuotaCycleStart, "锚点已到，当期起点应写入")
		require.Zero(t, member.SpendingUsed, "第一期开始时已消费清零")
		require.Equal(t, []int64{testOrganizationMemberID}, fixture.authCache.invalidatedUserIDs)
	})

	t.Run("未来锚点未生效静态原样保留", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		ctx := context.Background()
		staticLimit := 88.0
		fixture.members.members[testOrganizationMemberID].SpendingLimit = &staticLimit
		fixture.members.members[testOrganizationMemberID].SpendingUsed = 7

		future := time.Now().Add(48 * time.Hour)
		member, err := fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, testOrganizationMemberID, &PeriodicQuotaInput{
			Amount:     100,
			PeriodDays: 30,
			StartAt:    future,
		})
		require.NoError(t, err)
		require.NotNil(t, member.QuotaAmount)
		require.Nil(t, member.QuotaCycleStart, "锚点在未来，当期起点留空表示未生效")
		require.Equal(t, 7.0, member.SpendingUsed, "未生效时静态已用不动")
		require.Equal(t, &staticLimit, member.EffectiveSpendingLimit(time.Now()), "生效前沿用静态上限")
		require.Equal(t, &staticLimit, member.SpendingLimit, "静态上限列不清")
	})

	t.Run("取消周期回到静态且已用保留", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		ctx := context.Background()
		_, err := fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, testOrganizationMemberID, &PeriodicQuotaInput{
			Amount:     100,
			PeriodDays: 30,
			StartAt:    time.Now(),
		})
		require.NoError(t, err)
		fixture.members.members[testOrganizationMemberID].SpendingUsed = 33

		member, err := fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, testOrganizationMemberID, nil)
		require.NoError(t, err)
		require.Nil(t, member.QuotaAmount)
		require.Nil(t, member.QuotaPeriodDays)
		require.Nil(t, member.QuotaStartAt)
		require.Nil(t, member.QuotaCycleStart)
		require.Equal(t, 33.0, member.SpendingUsed, "取消周期已消费不清零")
	})

	t.Run("每期金额为零合法表示每期禁止", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		ctx := context.Background()
		member, err := fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, testOrganizationMemberID, &PeriodicQuotaInput{
			Amount:     0,
			PeriodDays: 7,
			StartAt:    time.Now(),
		})
		require.NoError(t, err)
		require.NotNil(t, member.QuotaAmount)
		require.Zero(t, *member.QuotaAmount)
	})

	t.Run("非法取值被拒绝", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		ctx := context.Background()
		now := time.Now()

		_, err := fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, testOrganizationMemberID, &PeriodicQuotaInput{Amount: -1, PeriodDays: 7, StartAt: now})
		require.ErrorIs(t, err, ErrOrganizationQuotaAmountInvalid)

		_, err = fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, testOrganizationMemberID, &PeriodicQuotaInput{Amount: 10, PeriodDays: 0, StartAt: now})
		require.ErrorIs(t, err, ErrOrganizationQuotaPeriodInvalid)

		_, err = fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, testOrganizationMemberID, &PeriodicQuotaInput{Amount: 10, PeriodDays: QuotaMaxPeriodDays + 1, StartAt: now})
		require.ErrorIs(t, err, ErrOrganizationQuotaPeriodInvalid)

		require.Empty(t, fixture.members.quotaWrites, "校验失败不应有任何写入")
	})

	t.Run("越权与保护规则同静态上限", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		ctx := context.Background()
		now := time.Now()

		_, err := fixture.service.UpdateQuota(ctx, testOrganizationMemberID, testOrganizationOtherID, &PeriodicQuotaInput{Amount: 10, PeriodDays: 7, StartAt: now})
		require.ErrorIs(t, err, ErrOrganizationOwnerRequired)

		_, err = fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, testOrganizationOwnerID, &PeriodicQuotaInput{Amount: 10, PeriodDays: 7, StartAt: now})
		require.ErrorIs(t, err, ErrOrganizationMemberOwnerImmutable)

		_, err = fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, 99, &PeriodicQuotaInput{Amount: 10, PeriodDays: 7, StartAt: now})
		require.ErrorIs(t, err, ErrOrganizationMemberNotFound)

		require.Empty(t, fixture.members.quotaWrites)
	})
}

func TestOrganizationMemberServiceBatchSetQuota(t *testing.T) {
	future := time.Now().Add(24 * time.Hour)

	t.Run("同一份配置发给所有人", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		ctx := context.Background()

		members, err := fixture.service.BatchSetQuota(ctx, testOrganizationOwnerID,
			[]int64{testOrganizationMemberID, testOrganizationOtherID},
			&PeriodicQuotaInput{Amount: 60, PeriodDays: 30, StartAt: future},
		)
		require.NoError(t, err)
		require.Len(t, members, 2)
		for _, member := range members {
			require.NotNil(t, member.QuotaAmount)
			require.Equal(t, 60.0, *member.QuotaAmount)
			require.Equal(t, 30, *member.QuotaPeriodDays)
			require.Nil(t, member.QuotaCycleStart)
		}
		require.Len(t, fixture.members.quotaWrites, 1)
		require.Len(t, fixture.members.quotaWrites[0], 2)
		require.Contains(t, fixture.authCache.invalidatedUserIDs, testOrganizationMemberID)
		require.Contains(t, fixture.authCache.invalidatedUserIDs, testOrganizationOtherID)
	})

	t.Run("混入管理员本人或不存在账号整笔拒绝", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		ctx := context.Background()

		_, err := fixture.service.BatchSetQuota(ctx, testOrganizationOwnerID,
			[]int64{testOrganizationMemberID, testOrganizationOwnerID},
			&PeriodicQuotaInput{Amount: 60, PeriodDays: 30, StartAt: future},
		)
		require.ErrorIs(t, err, ErrOrganizationMemberOwnerImmutable)
		require.Empty(t, fixture.members.quotaWrites)

		_, err = fixture.service.BatchSetQuota(ctx, testOrganizationOwnerID,
			[]int64{testOrganizationMemberID, 99},
			&PeriodicQuotaInput{Amount: 60, PeriodDays: 30, StartAt: future},
		)
		require.ErrorIs(t, err, ErrOrganizationMemberNotFound)
		require.Empty(t, fixture.members.quotaWrites)
	})

	t.Run("空目标列表被拒绝", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		ctx := context.Background()

		_, err := fixture.service.BatchSetQuota(ctx, testOrganizationOwnerID, nil, &PeriodicQuotaInput{Amount: 60, PeriodDays: 30, StartAt: future})
		require.ErrorIs(t, err, ErrOrganizationQuotaTargets)
	})
}

func TestOrganizationMemberServiceStaticOpsClearQuota(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()

	_, err := fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, testOrganizationMemberID, &PeriodicQuotaInput{
		Amount:     100,
		PeriodDays: 30,
		StartAt:    time.Now(),
	})
	require.NoError(t, err)

	// 改静态上限即退出周期模式。
	_, err = fixture.service.UpdateSpendingLimit(ctx, testOrganizationOwnerID, testOrganizationMemberID, spendingLimitPtr(10))
	require.NoError(t, err)
	stored := fixture.members.members[testOrganizationMemberID]
	require.Nil(t, stored.QuotaAmount)
	require.Nil(t, stored.QuotaCycleStart)
	require.NotNil(t, stored.SpendingLimit)

	// 均分同样整批退出周期模式。
	_, err = fixture.service.UpdateQuota(ctx, testOrganizationOwnerID, testOrganizationOtherID, &PeriodicQuotaInput{
		Amount:     100,
		PeriodDays: 30,
		StartAt:    time.Now(),
	})
	require.NoError(t, err)
	_, err = fixture.service.SplitSpendingLimit(ctx, testOrganizationOwnerID, []int64{testOrganizationMemberID, testOrganizationOtherID}, 20)
	require.NoError(t, err)
	for _, member := range fixture.members.members {
		if member.IsOwner {
			continue
		}
		require.Nil(t, member.QuotaAmount, "静态均分后周期配置应被清掉")
	}
}

func TestOrganizationMemberServiceAdvanceDueQuotas(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()

	// 已生效但早已过了当期：起点落后两期，已用带着旧周期的数字。
	amount := 40.0
	periodDays := 1
	anchor := quotaDay(time.Now().Add(-72 * time.Hour)).UTC()
	member := fixture.members.members[testOrganizationMemberID]
	member.QuotaAmount = &amount
	member.QuotaPeriodDays = &periodDays
	member.QuotaStartAt = &anchor
	member.QuotaCycleStart = &anchor
	member.SpendingUsed = 39

	members, _, err := fixture.service.List(ctx, testOrganizationOwnerID, pagination.DefaultPagination(), OrganizationMemberListFilters{})
	require.NoError(t, err)
	for i := range members {
		if members[i].UserID != testOrganizationMemberID {
			continue
		}
		require.Zero(t, members[i].SpendingUsed, "换期后当期已用清零")
		require.NotNil(t, members[i].QuotaCycleStart)
		require.True(t, members[i].QuotaCycleStart.After(anchor), "当期起点应推进")
		require.Equal(t, 40.0, *members[i].EffectiveSpendingLimit(time.Now()))
	}
}
