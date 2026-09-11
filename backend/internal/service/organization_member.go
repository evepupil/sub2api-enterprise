package service

import (
	"context"
	"errors"
	"math"
	"sort"
	"strings"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"

	"github.com/shopspring/decimal"
)

var (
	ErrOrganizationMemberNotFound = infraerrors.NotFound(
		"ORGANIZATION_MEMBER_NOT_FOUND",
		"organization member not found",
	)
	ErrOrganizationMemberOwnerImmutable = infraerrors.BadRequest(
		"ORGANIZATION_MEMBER_OWNER_IMMUTABLE",
		"organization owner cannot be managed as a member",
	)
	ErrOrganizationMemberStatusInvalid = infraerrors.BadRequest(
		"ORGANIZATION_MEMBER_STATUS_INVALID",
		"member status must be active or disabled",
	)
	ErrOrganizationMemberPlatformAdmin = infraerrors.BadRequest(
		"ORGANIZATION_MEMBER_PLATFORM_ADMIN",
		"platform administrators cannot be managed from an organization",
	)
	ErrOrganizationSpendingLimitInvalid = infraerrors.BadRequest(
		"ORGANIZATION_SPENDING_LIMIT_INVALID",
		"spending limit must be zero or a positive amount",
	)
	ErrOrganizationSpendingSplitTargets = infraerrors.BadRequest(
		"ORGANIZATION_SPENDING_SPLIT_TARGETS",
		"select at least one organization member to split the amount",
	)
)

// OrganizationMember 是组织管理员在成员管理页看到的一条成员记录。
//
// SpendingLimit 表示该成员累计最多可以消费的金额：
//
//	nil → 不限额（默认），只受组织付款账号余额约束
//	0   → 完全不能消费
//	> 0 → 最多累计消费该金额
//
// 注意这里的 0 表示禁止，与 api_keys.quota、users.rpm_limit 的「0 = 不限制」相反，
// 与 user_platform_quotas 一致。
//
// SpendingUsed 是累计已消费金额，SpendingFrozen 是批量出图等预扣业务占住的金额，
// 两者都由组织结算在扣费事务里维护。
type OrganizationMember struct {
	UserID         int64
	Email          string
	Username       string
	Status         string
	Role           string
	IsOwner        bool
	SpendingLimit  *float64
	SpendingUsed   float64
	SpendingFrozen float64
	JoinedAt       time.Time
}

// SpendingRemaining 返回剩余额度，等于上限减已消费金额再减已冻结金额。
// 不限额时返回 nil；算出来是负数时返回 0。
func (m *OrganizationMember) SpendingRemaining() *float64 {
	if m == nil || m.SpendingLimit == nil {
		return nil
	}
	remaining := QuantizeUsageBillingAmount(*m.SpendingLimit - m.SpendingUsed - m.SpendingFrozen)
	if remaining < 0 {
		remaining = 0
	}
	return &remaining
}

// OrganizationMemberListFilters 限定成员列表的查询条件。组织范围不在这里传，
// 由服务端根据登录身份决定。
type OrganizationMemberListFilters struct {
	Search string
	Status string
}

// OrganizationMemberSpendingLimit 是一次批量写入中的单个成员上限。
type OrganizationMemberSpendingLimit struct {
	UserID int64
	Limit  *float64
}

type OrganizationMemberRepository interface {
	List(
		ctx context.Context,
		organizationID int64,
		params pagination.PaginationParams,
		filters OrganizationMemberListFilters,
	) ([]OrganizationMember, *pagination.PaginationResult, error)
	Get(ctx context.Context, organizationID int64, userID int64) (*OrganizationMember, error)
	// SetSpendingLimits 在同一个事务里写入多个成员的上限，全部成功或全部不生效。
	SetSpendingLimits(ctx context.Context, organizationID int64, limits []OrganizationMemberSpendingLimit) error
}

// OrganizationMemberService 提供组织管理员对本组织成员的查看、启停和消费上限管理。
// 每个入口都先确认调用者是组织创建者，再确认目标成员属于同一组织。
type OrganizationMemberService struct {
	organizations *OrganizationService
	members       OrganizationMemberRepository
	users         UserRepository
	authCache     APIKeyAuthCacheInvalidator
}

func NewOrganizationMemberService(
	organizations *OrganizationService,
	members OrganizationMemberRepository,
	users UserRepository,
	authCache APIKeyAuthCacheInvalidator,
) *OrganizationMemberService {
	return &OrganizationMemberService{
		organizations: organizations,
		members:       members,
		users:         users,
		authCache:     authCache,
	}
}

// requireOwnedOrganization 确认调用者是某个组织的创建者，并返回该组织。
func (s *OrganizationMemberService) requireOwnedOrganization(
	ctx context.Context,
	actorUserID int64,
) (*OrganizationSummary, error) {
	if s == nil || s.organizations == nil || s.members == nil || s.users == nil {
		return nil, ErrServiceUnavailable
	}
	summary, err := s.organizations.GetSummaryByUserID(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	if summary == nil || !summary.IsOwner {
		return nil, ErrOrganizationOwnerRequired
	}
	return summary, nil
}

// requireManageableMember 取出目标成员并确认它可以被组织管理员操作。
// 目标不属于本组织时统一返回“成员不存在”，不暴露其他组织的数据。
func (s *OrganizationMemberService) requireManageableMember(
	ctx context.Context,
	organizationID int64,
	targetUserID int64,
) (*OrganizationMember, error) {
	if targetUserID <= 0 {
		return nil, ErrOrganizationMemberNotFound
	}
	member, err := s.members.Get(ctx, organizationID, targetUserID)
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, ErrOrganizationMemberNotFound
	}
	if member.IsOwner {
		return nil, ErrOrganizationMemberOwnerImmutable
	}
	return member, nil
}

func (s *OrganizationMemberService) List(
	ctx context.Context,
	actorUserID int64,
	params pagination.PaginationParams,
	filters OrganizationMemberListFilters,
) ([]OrganizationMember, *pagination.PaginationResult, error) {
	summary, err := s.requireOwnedOrganization(ctx, actorUserID)
	if err != nil {
		return nil, nil, err
	}
	filters.Search = strings.TrimSpace(filters.Search)
	filters.Status = strings.TrimSpace(filters.Status)
	switch filters.Status {
	case "", StatusActive, StatusDisabled:
	default:
		return nil, nil, ErrOrganizationMemberStatusInvalid
	}
	return s.members.List(ctx, summary.ID, params, filters)
}

// UpdateStatus 启用或停用一个普通成员。只改账号状态，成员关系、消费上限、
// 已消费金额、密钥和历史记录都保留。
func (s *OrganizationMemberService) UpdateStatus(
	ctx context.Context,
	actorUserID int64,
	targetUserID int64,
	status string,
) (*OrganizationMember, error) {
	summary, err := s.requireOwnedOrganization(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	status = strings.TrimSpace(status)
	if status != StatusActive && status != StatusDisabled {
		return nil, ErrOrganizationMemberStatusInvalid
	}
	member, err := s.requireManageableMember(ctx, summary.ID, targetUserID)
	if err != nil {
		return nil, err
	}
	if member.Role == RoleAdmin {
		return nil, ErrOrganizationMemberPlatformAdmin
	}
	if member.Status == status {
		return member, nil
	}

	user, err := s.users.GetByID(ctx, targetUserID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, ErrOrganizationMemberNotFound
		}
		return nil, err
	}
	user.Status = status
	if err := s.users.Update(ctx, user, UserUpdateFields{Status: true}); err != nil {
		return nil, err
	}
	// 状态改完必须清理鉴权缓存，否则停用会在一个缓存周期内不生效。
	if s.authCache != nil {
		s.authCache.InvalidateAuthCacheByUserID(ctx, targetUserID)
	}
	member.Status = status
	return member, nil
}

// UpdateSpendingLimit 设定单个成员的消费上限。limit 为 nil 表示改为不限额。
// 允许把上限调到低于已消费金额，已发生的消费不受影响。
func (s *OrganizationMemberService) UpdateSpendingLimit(
	ctx context.Context,
	actorUserID int64,
	targetUserID int64,
	limit *float64,
) (*OrganizationMember, error) {
	summary, err := s.requireOwnedOrganization(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	normalized, err := normalizeSpendingLimit(limit)
	if err != nil {
		return nil, err
	}
	member, err := s.requireManageableMember(ctx, summary.ID, targetUserID)
	if err != nil {
		return nil, err
	}
	if err := s.members.SetSpendingLimits(ctx, summary.ID, []OrganizationMemberSpendingLimit{
		{UserID: targetUserID, Limit: normalized},
	}); err != nil {
		return nil, err
	}
	s.invalidateSpendingCaches(ctx, targetUserID)
	member.SpendingLimit = normalized
	return member, nil
}

// invalidateSpendingCaches 让新的消费上限立刻生效。
// 上限跟着鉴权快照一起缓存，不清掉的话调用前的额度判断会在一个缓存周期内还用旧上限。
func (s *OrganizationMemberService) invalidateSpendingCaches(ctx context.Context, userIDs ...int64) {
	if s.authCache == nil {
		return
	}
	for _, userID := range userIDs {
		if userID > 0 {
			s.authCache.InvalidateAuthCacheByUserID(ctx, userID)
		}
	}
}

// SplitSpendingLimit 把一笔总额均分给选中的普通成员，作为他们各自的新上限，
// 覆盖原有上限。一笔均分要么全部改完，要么一个都不改。
func (s *OrganizationMemberService) SplitSpendingLimit(
	ctx context.Context,
	actorUserID int64,
	targetUserIDs []int64,
	total float64,
) ([]OrganizationMember, error) {
	summary, err := s.requireOwnedOrganization(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	userIDs := dedupeSortedUserIDs(targetUserIDs)
	if len(userIDs) == 0 {
		return nil, ErrOrganizationSpendingSplitTargets
	}
	shares, err := SplitSpendingAmount(total, len(userIDs))
	if err != nil {
		return nil, err
	}

	members := make([]OrganizationMember, 0, len(userIDs))
	limits := make([]OrganizationMemberSpendingLimit, 0, len(userIDs))
	for i, userID := range userIDs {
		member, err := s.requireManageableMember(ctx, summary.ID, userID)
		if err != nil {
			return nil, err
		}
		share := shares[i]
		member.SpendingLimit = &share
		members = append(members, *member)
		limits = append(limits, OrganizationMemberSpendingLimit{UserID: userID, Limit: &share})
	}
	if err := s.members.SetSpendingLimits(ctx, summary.ID, limits); err != nil {
		return nil, err
	}
	s.invalidateSpendingCaches(ctx, userIDs...)
	return members, nil
}

// normalizeSpendingLimit 校验并按计费精度取整消费上限。nil 表示不限额。
func normalizeSpendingLimit(limit *float64) (*float64, error) {
	if limit == nil {
		return nil, nil
	}
	value := *limit
	if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		return nil, ErrOrganizationSpendingLimitInvalid
	}
	quantized := QuantizeUsageBillingAmount(value)
	return &quantized, nil
}

// dedupeSortedUserIDs 去掉重复和非法的成员标识，并按标识升序排列，
// 让均分的余数分配在同一批成员上始终得到相同结果。
func dedupeSortedUserIDs(userIDs []int64) []int64 {
	seen := make(map[int64]struct{}, len(userIDs))
	out := make([]int64, 0, len(userIDs))
	for _, id := range userIDs {
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

// SplitSpendingAmount 把 total 平均分成 count 份，按计费精度取整；除不尽的余数
// 按最小单位依次补给排在前面的份额，保证各份之和精确等于 total。
func SplitSpendingAmount(total float64, count int) ([]float64, error) {
	if count <= 0 {
		return nil, ErrOrganizationSpendingSplitTargets
	}
	if math.IsNaN(total) || math.IsInf(total, 0) || total < 0 {
		return nil, ErrOrganizationSpendingLimitInvalid
	}

	amount := decimal.NewFromFloat(QuantizeUsageBillingAmount(total))
	share, remainder := amount.QuoRem(decimal.NewFromInt(int64(count)), UsageBillingMonetaryScale)
	// remainder 一定小于 count 个最小单位，右移后就是要多分出去的最小单位个数。
	extraUnits := remainder.Shift(UsageBillingMonetaryScale).IntPart()
	unit := decimal.New(1, -int32(UsageBillingMonetaryScale))

	shares := make([]float64, 0, count)
	for i := 0; i < count; i++ {
		value := share
		if int64(i) < extraUnits {
			value = value.Add(unit)
		}
		converted, _ := value.Float64()
		shares = append(shares, converted)
	}
	return shares, nil
}
