package service

import (
	"context"
	"math"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

var (
	ErrOrganizationQuotaPeriodInvalid = infraerrors.BadRequest(
		"ORGANIZATION_QUOTA_PERIOD_INVALID",
		"quota period days must be between 1 and 3650",
	)
	ErrOrganizationQuotaAmountInvalid = infraerrors.BadRequest(
		"ORGANIZATION_QUOTA_AMOUNT_INVALID",
		"quota amount must be zero or a positive amount",
	)
	ErrOrganizationQuotaStartInvalid = infraerrors.BadRequest(
		"ORGANIZATION_QUOTA_START_INVALID",
		"quota start time is invalid",
	)
	ErrOrganizationQuotaTargets = infraerrors.BadRequest(
		"ORGANIZATION_QUOTA_TARGETS",
		"select at least one organization member to apply the periodic quota",
	)
)

// QuotaMaxPeriodDays 限制周期长度，防止一次误操作把下一期推到十年后。
const QuotaMaxPeriodDays = 3650

// QuotaMode 是成员配额在某一时刻的执行模式。
type QuotaMode string

const (
	// QuotaModeStatic 按静态累计上限执行：留空不限额、0 禁止、数值为累计总额。
	QuotaModeStatic QuotaMode = "static"
	// QuotaModePending 配了周期配额但锚点还在未来，生效前按静态状态执行。
	QuotaModePending QuotaMode = "periodic_pending"
	// QuotaModeActive 周期配额生效中，上限取每期金额，已消费按当期累计。
	QuotaModeActive QuotaMode = "periodic_active"
)

// MemberQuotaState 是把成员的周期配额列按某一时刻解析后的状态。
//
// 解析不落库：需要落库的写路径看 NeedsAdvance 自己持久化，
// 只读路径（鉴权快照）拿 CycleStart / WindowEnd 直接用。
type MemberQuotaState struct {
	Mode QuotaMode
	// Amount 周期金额，仅在配置了周期配额时非空；0 表示每期禁止消费。
	Amount *float64
	// PeriodDays 周期天数，仅在配置了周期配额时非空。
	PeriodDays *int
	// StartAt 开始锚点，仅在配置了周期配额时非空。
	StartAt *time.Time
	// CycleStart 解析后的当期起点。生效中一定非空；未生效为空。
	CycleStart *time.Time
	// WindowEnd 本期截止时间（CycleStart + 周期），生效中一定非空。
	WindowEnd *time.Time
	// NeedsAdvance 表示解析时发生了激活或换期，CycleStart 是推进后的新值，
	// 当期已消费应清零，需要由写路径落库。
	NeedsAdvance bool
}

// ResolveMemberQuotaState 把成员的周期配额列按 now 解析成执行状态。
//
// 这是配额模式判断的唯一权威：所有读写路径（设置接口、调用前判断、扣费、
// 预扣、鉴权快照、管理页展示）都必须经过这里，不允许各自比时间。
// 未配置周期（quotaAmount 为空）时返回静态模式。
func ResolveMemberQuotaState(
	quotaAmount *float64,
	quotaPeriodDays *int,
	quotaStartAt *time.Time,
	quotaCycleStart *time.Time,
	now time.Time,
) MemberQuotaState {
	if quotaAmount == nil {
		return MemberQuotaState{Mode: QuotaModeStatic}
	}

	periodDays := *quotaPeriodDays
	startAt := *quotaStartAt
	state := MemberQuotaState{
		Amount:     quotaAmount,
		PeriodDays: &periodDays,
		StartAt:    &startAt,
	}

	if now.Before(startAt) {
		// 锚点在未来：尚未生效，生效前按静态状态执行。
		state.Mode = QuotaModePending
		return state
	}

	// 已越过锚点：当期起点要么是库里的 quotaCycleStart（已生效过），
	// 要么从锚点起算（首次激活）。对齐到当前期。
	// 激活本身就是一次推进——静态时期攒下的已消费不能带进第一期。
	activation := quotaCycleStart == nil
	aligned := AlignQuotaCycleStart(startAt, periodDays, now)
	cycleStart := aligned
	windowEnd := cycleStart.Add(quotaPeriodDuration(periodDays))

	state.Mode = QuotaModeActive
	state.CycleStart = &cycleStart
	state.WindowEnd = &windowEnd
	if activation {
		state.NeedsAdvance = true
		return state
	}
	// 已生效过：库里的起点落后于对齐结果，说明该换期了。
	if aligned.After(*quotaCycleStart) {
		state.NeedsAdvance = true
	}
	return state
}

// AlignQuotaCycleStart 把锚点对齐到 now 所在的周期起点：
// 锚点加 k 个整周期（k 为已完整过掉的期数），保证起点 ≤ now < 起点 + 周期。
// 一次跨过多期也一步到位，这就是惰性推进的「推进」部分。
func AlignQuotaCycleStart(anchor time.Time, periodDays int, now time.Time) time.Time {
	period := quotaPeriodDuration(periodDays)
	elapsed := now.Sub(anchor)
	if elapsed <= 0 {
		return anchor
	}
	k := elapsed / period
	return anchor.Add(k * period)
}

func quotaPeriodDuration(periodDays int) time.Duration {
	return time.Duration(periodDays) * 24 * time.Hour
}

// EffectiveSpendingLimit 返回该成员在 now 时刻的生效上限，nil 表示不限额。
// 周期生效中取「每期金额加本期一次性加成」（加成来自配额申请，换期清零），
// 其余情况取静态上限。
func (m *OrganizationMember) EffectiveSpendingLimit(now time.Time) *float64 {
	if m == nil {
		return nil
	}
	state := ResolveMemberQuotaState(m.QuotaAmount, m.QuotaPeriodDays, m.QuotaStartAt, m.QuotaCycleStart, now)
	if state.Mode == QuotaModeActive {
		limit := QuantizeUsageBillingAmount(*state.Amount + m.QuotaCycleBonus)
		return &limit
	}
	return m.SpendingLimit
}

// QuotaState 返回该成员在 now 时刻的配额执行状态，供接口层展示。
func (m *OrganizationMember) QuotaState(now time.Time) MemberQuotaState {
	if m == nil {
		return MemberQuotaState{Mode: QuotaModeStatic}
	}
	return ResolveMemberQuotaState(m.QuotaAmount, m.QuotaPeriodDays, m.QuotaStartAt, m.QuotaCycleStart, now)
}

// SpendingRemainingAt 返回 now 时刻的剩余额度：生效上限减已消费减已冻结。
// 不限额时返回 nil；算出来是负数时返回 0。
func (m *OrganizationMember) SpendingRemainingAt(now time.Time) *float64 {
	if m == nil {
		return nil
	}
	limit := m.EffectiveSpendingLimit(now)
	if limit == nil {
		return nil
	}
	remaining := QuantizeUsageBillingAmount(*limit - m.SpendingUsed - m.SpendingFrozen)
	if remaining < 0 {
		remaining = 0
	}
	return &remaining
}

// PeriodicQuotaInput 是一次周期配额设置（单人或批量共用一份配置）。
type PeriodicQuotaInput struct {
	// Amount 每期金额，0 表示每期禁止消费。
	Amount float64
	// PeriodDays 周期天数，1 到 3650。
	PeriodDays int
	// StartAt 开始锚点。为零值时由服务端取当前时刻。
	StartAt time.Time
}

func (in PeriodicQuotaInput) validate() (PeriodicQuotaInput, error) {
	if math.IsNaN(in.Amount) || math.IsInf(in.Amount, 0) || in.Amount < 0 {
		return in, ErrOrganizationQuotaAmountInvalid
	}
	if in.PeriodDays < 1 || in.PeriodDays > QuotaMaxPeriodDays {
		return in, ErrOrganizationQuotaPeriodInvalid
	}
	if in.StartAt.IsZero() {
		return in, ErrOrganizationQuotaStartInvalid
	}
	out := in
	out.Amount = QuantizeUsageBillingAmount(in.Amount)
	return out, nil
}

// UpdateQuota 设定单个成员的周期配额。quota 为 nil 表示取消周期、回到静态模式。
//
// 设周期不动静态上限两列：锚点在未来时生效前要用静态状态顶着，取消周期后
// 也回到这个静态状态。锚点已到（现在或过去）时第一期立刻开始，已消费清零。
func (s *OrganizationMemberService) UpdateQuota(
	ctx context.Context,
	actorUserID int64,
	targetUserID int64,
	quota *PeriodicQuotaInput,
) (*OrganizationMember, error) {
	summary, err := s.requireOwnedOrganization(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	member, err := s.requireManageableMember(ctx, summary.ID, targetUserID)
	if err != nil {
		return nil, err
	}
	if err := s.applyQuota(ctx, summary.ID, []*OrganizationMember{member}, quota); err != nil {
		return nil, err
	}
	return member, nil
}

// BatchSetQuota 把同一份周期配额发给选中的普通成员，人人相同。
// 一笔发放要么全部成员改完，要么一个都不改。quota 为 nil 时整批取消周期。
func (s *OrganizationMemberService) BatchSetQuota(
	ctx context.Context,
	actorUserID int64,
	targetUserIDs []int64,
	quota *PeriodicQuotaInput,
) ([]OrganizationMember, error) {
	summary, err := s.requireOwnedOrganization(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	userIDs := dedupeSortedUserIDs(targetUserIDs)
	if len(userIDs) == 0 {
		return nil, ErrOrganizationQuotaTargets
	}

	members := make([]*OrganizationMember, 0, len(userIDs))
	for _, userID := range userIDs {
		member, err := s.requireManageableMember(ctx, summary.ID, userID)
		if err != nil {
			return nil, err
		}
		members = append(members, member)
	}
	if err := s.applyQuota(ctx, summary.ID, members, quota); err != nil {
		return nil, err
	}
	out := make([]OrganizationMember, 0, len(members))
	for _, member := range members {
		out = append(out, *member)
	}
	return out, nil
}

// applyQuota 校验配置后整批写入，并同步改内存对象、清鉴权缓存。
func (s *OrganizationMemberService) applyQuota(
	ctx context.Context,
	organizationID int64,
	members []*OrganizationMember,
	quota *PeriodicQuotaInput,
) error {
	now := time.Now()

	var writes []OrganizationMemberQuotaWrite
	if quota == nil {
		// 取消周期：四个周期列清空，已消费不清零，从现在起按静态上限继续比较。
		for _, member := range members {
			member.QuotaAmount = nil
			member.QuotaPeriodDays = nil
			member.QuotaStartAt = nil
			member.QuotaCycleStart = nil
			member.QuotaCycleBonus = 0
			writes = append(writes, OrganizationMemberQuotaWrite{UserID: member.UserID})
		}
	} else {
		normalized, err := quota.validate()
		if err != nil {
			return err
		}
		for _, member := range members {
			amount := normalized.Amount
			periodDays := normalized.PeriodDays
			startAt := normalized.StartAt
			member.QuotaAmount = &amount
			member.QuotaPeriodDays = &periodDays
			member.QuotaStartAt = &startAt
			// 换一套周期配置等于换一期：上一期的一次性加成不带过来。
			member.QuotaCycleBonus = 0
			if now.Before(startAt) {
				// 锚点在未来：尚未生效，静态状态原样保留。
				member.QuotaCycleStart = nil
				writes = append(writes, OrganizationMemberQuotaWrite{
					UserID:     member.UserID,
					Quota:      &normalized,
					CycleStart: nil,
					ResetUsed:  false,
				})
				continue
			}
			// 锚点已到：第一期立刻开始，对齐到当前期，已消费清零。
			cycleStart := AlignQuotaCycleStart(startAt, periodDays, now)
			member.QuotaCycleStart = &cycleStart
			member.SpendingUsed = 0
			writes = append(writes, OrganizationMemberQuotaWrite{
				UserID:     member.UserID,
				Quota:      &normalized,
				CycleStart: &cycleStart,
				ResetUsed:  true,
			})
		}
	}

	if err := s.members.SetPeriodicQuotas(ctx, organizationID, writes); err != nil {
		return err
	}
	userIDs := make([]int64, 0, len(members))
	for _, member := range members {
		userIDs = append(userIDs, member.UserID)
	}
	s.invalidateSpendingCaches(ctx, userIDs...)
	return nil
}

// AdvanceDueQuotas 把到期未推进的成员行在行锁里推进到当前期。
// 管理页列表与单人查询调用，保证管理员看到的当期已用与剩余是真的。
func (s *OrganizationMemberService) AdvanceDueQuotas(ctx context.Context, members []OrganizationMember) {
	now := time.Now()
	for i := range members {
		member := &members[i]
		state := member.QuotaState(now)
		if !state.NeedsAdvance {
			continue
		}
		advanced, err := s.members.AdvanceDueQuota(ctx, member.UserID, now)
		if err != nil {
			// 推进失败不影响列表返回，只是这一行的展示可能滞后，
			// 计费路径的推进不受影响（那边有事务兜底）。
			continue
		}
		if advanced != nil {
			member.QuotaCycleStart = advanced.QuotaCycleStart
			member.SpendingUsed = advanced.SpendingUsed
			member.QuotaCycleBonus = advanced.QuotaCycleBonus
		}
	}
}
