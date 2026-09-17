package service

import (
	"context"
	"math"
	"time"
)

// OrganizationDefaultQuota 是组织级默认周期配额配置。
// Enabled 为 false 时金额与天数为空；开启后新成员完成加入时自动抄入，
// 周期从加入时刻起算，与单人「立即生效」设置共享同一套周期语义。
type OrganizationDefaultQuota struct {
	Enabled    bool
	Amount     *float64
	PeriodDays *int
}

// OrganizationDefaultQuotaUpdate 是一次默认配额保存。
// 两个同步开关决定存量成员要不要一起换：
//   - SyncUnconfigured 只发目前还没配周期配额的普通成员（补空白）；
//   - SyncConfigured 只覆盖已经配了周期配额的普通成员（立即重置）；
//   - 两个都开等于全员统一；都不开则只影响之后加入的成员。
type OrganizationDefaultQuotaUpdate struct {
	Enabled          bool
	Amount           float64
	PeriodDays       int
	SyncUnconfigured bool
	SyncConfigured   bool
}

// OrganizationDefaultQuotaSynced 是保存结果：配置本身加上这次同步覆盖到的成员。
type OrganizationDefaultQuotaSynced struct {
	Quota         OrganizationDefaultQuota
	SyncedUserIDs []int64
}

// SyncedUsers 是这次同步换新的成员数量。
func (r OrganizationDefaultQuotaSynced) SyncedUsers() int {
	return len(r.SyncedUserIDs)
}

func (in OrganizationDefaultQuotaUpdate) validate() (OrganizationDefaultQuotaUpdate, error) {
	if !in.Enabled {
		// 关闭即清空配置，同步开关没有意义，直接归零。
		in.Amount = 0
		in.PeriodDays = 0
		in.SyncUnconfigured = false
		in.SyncConfigured = false
		return in, nil
	}
	if math.IsNaN(in.Amount) || math.IsInf(in.Amount, 0) || in.Amount < 0 {
		return in, ErrOrganizationQuotaAmountInvalid
	}
	if in.PeriodDays < 1 || in.PeriodDays > QuotaMaxPeriodDays {
		return in, ErrOrganizationQuotaPeriodInvalid
	}
	in.Amount = QuantizeUsageBillingAmount(in.Amount)
	return in, nil
}

// GetDefaultQuota 返回本组织的默认周期配额配置。
func (s *OrganizationMemberService) GetDefaultQuota(
	ctx context.Context,
	actorUserID int64,
) (*OrganizationDefaultQuota, error) {
	summary, err := s.requireOwnedOrganization(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	return s.members.GetDefaultQuota(ctx, summary.ID)
}

// UpdateDefaultQuota 保存默认周期配额，并在同一事务里按开关同步存量成员：
// 被同步的成员立即换新一期（当期起点 = 现在、当期已消费清零、加成清零），
// 与单人「立即生效」设置走同一写入路径。组织创建者本人的配额永远不动。
func (s *OrganizationMemberService) UpdateDefaultQuota(
	ctx context.Context,
	actorUserID int64,
	update OrganizationDefaultQuotaUpdate,
) (*OrganizationDefaultQuotaSynced, error) {
	summary, err := s.requireOwnedOrganization(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	normalized, err := update.validate()
	if err != nil {
		return nil, err
	}

	synced, err := s.members.UpdateDefaultQuota(ctx, summary.ID, normalized)
	if err != nil {
		return nil, err
	}
	if len(synced.SyncedUserIDs) > 0 {
		s.invalidateSpendingCaches(ctx, synced.SyncedUserIDs...)
	}
	return synced, nil
}

// joinDefaultQuotaCopy 把组织默认配额换算成新成员入组时抄入的周期配置：
// 周期从加入时刻起算，第一期当场开始。组织未开启默认配额时返回 false。
func joinDefaultQuotaCopy(org *Organization, joinedAt time.Time) (PeriodicQuotaInput, time.Time, bool) {
	if org == nil || !org.DefaultQuotaEnabled ||
		org.DefaultQuotaAmount == nil || org.DefaultQuotaPeriodDays == nil {
		return PeriodicQuotaInput{}, time.Time{}, false
	}
	return PeriodicQuotaInput{
		Amount:     *org.DefaultQuotaAmount,
		PeriodDays: *org.DefaultQuotaPeriodDays,
		StartAt:    joinedAt,
	}, joinedAt, true
}
