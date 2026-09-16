package service

import (
	"context"
	"errors"
	"math"
	"strings"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
)

// 配额申请策略：off 关闭、approve 先批后加、auto 即申即加。
const (
	QuotaRequestModeOff     = "off"
	QuotaRequestModeApprove = "approve"
	QuotaRequestModeAuto    = "auto"
)

// 申请状态与发放来源。
const (
	QuotaRequestStatusPending   = "pending"
	QuotaRequestStatusGranted   = "granted"
	QuotaRequestStatusRejected  = "rejected"
	QuotaRequestStatusWithdrawn = "withdrawn"

	QuotaRequestSourceManual = "manual"
	QuotaRequestSourceAuto   = "auto"

	// QuotaRequestReasonMaxLen 理由与审批备注的长度上限。
	QuotaRequestReasonMaxLen = 500
)

var (
	ErrOrganizationQuotaRequestModeInvalid = infraerrors.BadRequest(
		"ORGANIZATION_QUOTA_REQUEST_MODE_INVALID",
		"quota request mode must be off, approve or auto",
	)
	ErrOrganizationQuotaRequestRangeInvalid = infraerrors.BadRequest(
		"ORGANIZATION_QUOTA_REQUEST_RANGE_INVALID",
		"quota request range requires a positive min and a max no less than min",
	)
	ErrOrganizationQuotaRequestDisabled = infraerrors.BadRequest(
		"ORGANIZATION_QUOTA_REQUEST_DISABLED",
		"quota requests are disabled for this organization",
	)
	ErrOrganizationQuotaRequestAmountInvalid = infraerrors.BadRequest(
		"ORGANIZATION_QUOTA_REQUEST_AMOUNT_INVALID",
		"quota request amount is outside the allowed range",
	)
	ErrOrganizationQuotaRequestReasonTooLong = infraerrors.BadRequest(
		"ORGANIZATION_QUOTA_REQUEST_REASON_TOO_LONG",
		"quota request reason is too long",
	)
	ErrOrganizationQuotaRequestPendingExists = infraerrors.Conflict(
		"ORGANIZATION_QUOTA_REQUEST_PENDING_EXISTS",
		"a pending quota request already exists for this member",
	)
	ErrOrganizationQuotaRequestMemberIneligible = infraerrors.BadRequest(
		"ORGANIZATION_QUOTA_REQUEST_MEMBER_INELIGIBLE",
		"this member cannot request additional quota",
	)
	ErrOrganizationQuotaRequestNotFound = infraerrors.NotFound(
		"ORGANIZATION_QUOTA_REQUEST_NOT_FOUND",
		"quota request not found",
	)
	ErrOrganizationQuotaRequestNotPending = infraerrors.Conflict(
		"ORGANIZATION_QUOTA_REQUEST_NOT_PENDING",
		"quota request has already been handled",
	)
	ErrOrganizationQuotaRequestNoteTooLong = infraerrors.BadRequest(
		"ORGANIZATION_QUOTA_REQUEST_NOTE_TOO_LONG",
		"review note is too long",
	)
)

// OrganizationQuotaRequestPolicy 是组织的配额申请策略。
// Mode 为 off 时 Min / Max 为空；打开后两项必填。
type OrganizationQuotaRequestPolicy struct {
	Mode string
	Min  *float64
	Max  *float64
}

// Enabled 表示组织打开了「先批后加」或「即申即加」。
func (p *OrganizationQuotaRequestPolicy) Enabled() bool {
	return p != nil && p.Mode != QuotaRequestModeOff
}

// OrganizationQuotaRequest 是一条配额申请流水。
type OrganizationQuotaRequest struct {
	ID             int64
	OrganizationID int64
	UserID         int64
	Email          string
	Username       string
	Amount         float64
	Reason         string
	Status         string
	GrantSource    *string
	GrantedAmount  *float64
	SnapshotMode   string
	SnapshotLimit  *float64
	SnapshotUsed   float64
	ReviewerUserID int64
	ReviewedAt     *time.Time
	ReviewNote     string
	CreatedAt      time.Time
}

// OrganizationQuotaRequestListFilters 限定申请列表的查询条件。
type OrganizationQuotaRequestListFilters struct {
	Status string
}

// OrganizationQuotaRequestReview 是一次审批写入。
type OrganizationQuotaRequestReview struct {
	Status         string
	GrantSource    *string
	GrantedAmount  *float64
	ReviewerUserID int64
	ReviewNote     string
}

type OrganizationQuotaRequestRepository interface {
	GetPolicy(ctx context.Context, organizationID int64) (*OrganizationQuotaRequestPolicy, error)
	UpdatePolicy(ctx context.Context, organizationID int64, policy OrganizationQuotaRequestPolicy) error
	Create(ctx context.Context, request *OrganizationQuotaRequest) error
	Get(ctx context.Context, organizationID int64, requestID int64) (*OrganizationQuotaRequest, error)
	ListByOrganization(
		ctx context.Context,
		organizationID int64,
		params pagination.PaginationParams,
		filters OrganizationQuotaRequestListFilters,
	) ([]OrganizationQuotaRequest, *pagination.PaginationResult, error)
	ListByUser(
		ctx context.Context,
		userID int64,
		params pagination.PaginationParams,
		filters OrganizationQuotaRequestListFilters,
	) ([]OrganizationQuotaRequest, *pagination.PaginationResult, error)
	HasPending(ctx context.Context, organizationID int64, userID int64) (bool, error)
	// CreateAutoGranted 即申即加：同一事务里写已发放流水（来源=auto）
	// 并把金额加到成员身上（周期生效加 quota_cycle_bonus，其余加静态上限）。
	CreateAutoGranted(ctx context.Context, request *OrganizationQuotaRequest, member *OrganizationMember) error
	// Review 在一笔事务里处理一个待处理申请：先批后加的「通过」在这里把金额
	// 加到成员身上（周期生效加 quota_cycle_bonus，其余加静态上限），
	// 再把申请状态写成入参的终态。返回更新后的申请与成员。
	Review(
		ctx context.Context,
		organizationID int64,
		requestID int64,
		review OrganizationQuotaRequestReview,
	) (*OrganizationQuotaRequest, *OrganizationMember, error)
}

// ValidateQuotaRequestPolicy 校验组织策略。off 时清空最低最高；
// 打开后两项必填：都大于 0、最高不低于最低，按计费精度取整。
func ValidateQuotaRequestPolicy(mode string, min, max *float64) (OrganizationQuotaRequestPolicy, error) {
	normalizedMode := strings.TrimSpace(mode)
	switch normalizedMode {
	case QuotaRequestModeOff:
		return OrganizationQuotaRequestPolicy{Mode: QuotaRequestModeOff}, nil
	case QuotaRequestModeApprove, QuotaRequestModeAuto:
	default:
		return OrganizationQuotaRequestPolicy{}, ErrOrganizationQuotaRequestModeInvalid
	}

	if min == nil || max == nil {
		return OrganizationQuotaRequestPolicy{}, ErrOrganizationQuotaRequestRangeInvalid
	}
	normalizedMin := QuantizeUsageBillingAmount(*min)
	normalizedMax := QuantizeUsageBillingAmount(*max)
	if invalidAmount(normalizedMin) || invalidAmount(normalizedMax) || normalizedMax < normalizedMin {
		return OrganizationQuotaRequestPolicy{}, ErrOrganizationQuotaRequestRangeInvalid
	}
	return OrganizationQuotaRequestPolicy{
		Mode: normalizedMode,
		Min:  &normalizedMin,
		Max:  &normalizedMax,
	}, nil
}

func invalidAmount(value float64) bool {
	return math.IsNaN(value) || math.IsInf(value, 0) || value <= 0
}

// GetQuotaRequestPolicy 读取本组织的申请策略，只有组织创建者可以调用。
func (s *OrganizationMemberService) GetQuotaRequestPolicy(ctx context.Context, actorUserID int64) (*OrganizationQuotaRequestPolicy, error) {
	summary, err := s.requireOwnedOrganization(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	return s.quotaRequests.GetPolicy(ctx, summary.ID)
}

// UpdateQuotaRequestPolicy 修改本组织的申请策略，只有组织创建者可以调用。
func (s *OrganizationMemberService) UpdateQuotaRequestPolicy(
	ctx context.Context,
	actorUserID int64,
	mode string,
	min, max *float64,
) (*OrganizationQuotaRequestPolicy, error) {
	summary, err := s.requireOwnedOrganization(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	policy, err := ValidateQuotaRequestPolicy(mode, min, max)
	if err != nil {
		return nil, err
	}
	if err := s.quotaRequests.UpdatePolicy(ctx, summary.ID, policy); err != nil {
		return nil, err
	}
	return &policy, nil
}

// SubmitQuotaRequest 成员提交一笔配额申请：再追加一笔金额。
//
// 校验顺序：组织策略 → 金额区间 → 申请人资格（本组织普通成员、账号启用、
// 当前有限额）。即申即加在同一事务里加额度并记已发放；先批后加只记待处理。
func (s *OrganizationMemberService) SubmitQuotaRequest(
	ctx context.Context,
	actorUserID int64,
	amount float64,
	reason string,
) (*OrganizationQuotaRequest, error) {
	member, policy, err := s.requireRequestingMember(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	if !policy.Enabled() {
		return nil, ErrOrganizationQuotaRequestDisabled
	}
	normalizedAmount := QuantizeUsageBillingAmount(amount)
	if invalidAmount(normalizedAmount) ||
		normalizedAmount < *policy.Min || normalizedAmount > *policy.Max {
		return nil, ErrOrganizationQuotaRequestAmountInvalid
	}
	reason = strings.TrimSpace(reason)
	if len([]rune(reason)) > QuotaRequestReasonMaxLen {
		return nil, ErrOrganizationQuotaRequestReasonTooLong
	}

	pending, err := s.quotaRequests.HasPending(ctx, member.OrganizationID, actorUserID)
	if err != nil {
		return nil, err
	}
	if pending {
		return nil, ErrOrganizationQuotaRequestPendingExists
	}

	now := time.Now()
	state := member.QuotaState(now)
	snapshot := snapshotFromMember(member, state)

	if policy.Mode == QuotaRequestModeAuto {
		// 即申即加：先在内存里套用加成（周期生效进当期，其余进静态上限），
		// 落库和记流水放在同一笔事务里，由仓储保证原子性。
		applyQuotaTopUp(member, normalizedAmount, now)
		request := &OrganizationQuotaRequest{
			OrganizationID: member.OrganizationID,
			UserID:         actorUserID,
			Amount:         normalizedAmount,
			Reason:         reason,
			Status:         QuotaRequestStatusGranted,
			GrantSource:    stringPtr(QuotaRequestSourceAuto),
			GrantedAmount:  &normalizedAmount,
			SnapshotMode:   snapshot.mode,
			SnapshotLimit:  snapshot.limit,
			SnapshotUsed:   snapshot.used,
			CreatedAt:      now,
		}
		if err := s.quotaRequests.CreateAutoGranted(ctx, request, member); err != nil {
			return nil, err
		}
		s.invalidateSpendingCaches(ctx, actorUserID)
		return request, nil
	}

	request := &OrganizationQuotaRequest{
		OrganizationID: member.OrganizationID,
		UserID:         actorUserID,
		Amount:         normalizedAmount,
		Reason:         reason,
		Status:         QuotaRequestStatusPending,
		SnapshotMode:   snapshot.mode,
		SnapshotLimit:  snapshot.limit,
		SnapshotUsed:   snapshot.used,
		CreatedAt:      now,
	}
	if err := s.quotaRequests.Create(ctx, request); err != nil {
		return nil, err
	}
	return request, nil
}

// WithdrawQuotaRequest 成员撤回自己的一笔待处理申请，额度不动。
func (s *OrganizationMemberService) WithdrawQuotaRequest(ctx context.Context, actorUserID int64, requestID int64) (*OrganizationQuotaRequest, error) {
	member, err := s.requireOrdinaryMember(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	request, err := s.quotaRequests.Get(ctx, member.OrganizationID, requestID)
	if err != nil {
		return nil, err
	}
	if request.UserID != actorUserID || request.Status != QuotaRequestStatusPending {
		return nil, ErrOrganizationQuotaRequestNotFound
	}
	updated, _, err := s.quotaRequests.Review(ctx, member.OrganizationID, requestID, OrganizationQuotaRequestReview{
		Status:         QuotaRequestStatusWithdrawn,
		ReviewerUserID: actorUserID,
	})
	return updated, err
}

// ListQuotaRequests 列出申请：组织创建者看本组织全部，普通成员只看自己的。
// 不限额或已停用的成员也能看自己的流水，申请入口另由资格校验挡住。
func (s *OrganizationMemberService) ListQuotaRequests(
	ctx context.Context,
	actorUserID int64,
	params pagination.PaginationParams,
	filters OrganizationQuotaRequestListFilters,
) ([]OrganizationQuotaRequest, *pagination.PaginationResult, error) {
	if summary, err := s.organizations.GetSummaryByUserID(ctx, actorUserID); err != nil {
		return nil, nil, err
	} else if summary != nil && summary.IsOwner {
		filters.Status = normalizeQuotaRequestStatus(filters.Status)
		return s.quotaRequests.ListByOrganization(ctx, summary.ID, params, filters)
	}

	member, err := s.requireOrdinaryMember(ctx, actorUserID)
	if err != nil {
		return nil, nil, err
	}
	filters.Status = normalizeQuotaRequestStatus(filters.Status)
	return s.quotaRequests.ListByUser(ctx, member.UserID, params, filters)
}

// ApproveQuotaRequest 组织管理员通过一笔待处理申请。
//
// 审批时按成员此刻的生效模式发放（周期生效进当期加成，其余进静态上限）。
// 成员已变成不限额、被停用或不再是可申请对象时，申请自动作废（记驳回），
// 额度不动，并向管理员返回明确错误。
func (s *OrganizationMemberService) ApproveQuotaRequest(
	ctx context.Context,
	actorUserID int64,
	requestID int64,
	note string,
) (*OrganizationQuotaRequest, error) {
	summary, request, err := s.requireReviewableRequest(ctx, actorUserID, requestID)
	if err != nil {
		return nil, err
	}
	note = strings.TrimSpace(note)
	if len([]rune(note)) > QuotaRequestReasonMaxLen {
		return nil, ErrOrganizationQuotaRequestNoteTooLong
	}

	granted := request.Amount
	updated, _, err := s.quotaRequests.Review(ctx, summary.ID, requestID, OrganizationQuotaRequestReview{
		Status:         QuotaRequestStatusGranted,
		GrantSource:    stringPtr(QuotaRequestSourceManual),
		GrantedAmount:  &granted,
		ReviewerUserID: actorUserID,
		ReviewNote:     note,
	})
	if err != nil {
		// 成员此刻不能加（不限额 / 停用等）：申请已自动作废，额度不动。
		if errors.Is(err, ErrOrganizationQuotaRequestMemberIneligible) {
			return updated, err
		}
		return nil, err
	}
	s.invalidateSpendingCaches(ctx, request.UserID)
	return updated, nil
}

// RejectQuotaRequest 组织管理员驳回一笔待处理申请，额度不动，可留一句原因。
func (s *OrganizationMemberService) RejectQuotaRequest(
	ctx context.Context,
	actorUserID int64,
	requestID int64,
	note string,
) (*OrganizationQuotaRequest, error) {
	summary, _, err := s.requireReviewableRequest(ctx, actorUserID, requestID)
	if err != nil {
		return nil, err
	}
	note = strings.TrimSpace(note)
	if len([]rune(note)) > QuotaRequestReasonMaxLen {
		return nil, ErrOrganizationQuotaRequestNoteTooLong
	}
	updated, _, err := s.quotaRequests.Review(ctx, summary.ID, requestID, OrganizationQuotaRequestReview{
		Status:         QuotaRequestStatusRejected,
		ReviewerUserID: actorUserID,
		ReviewNote:     note,
	})
	return updated, err
}

// GetMyQuotaOverview 返回组织普通成员在仪表盘上看到的额度概况。
// 个人用户和组织管理员返回 nil（前端不渲染那张卡）。
func (s *OrganizationMemberService) GetMyQuotaOverview(ctx context.Context, actorUserID int64) (*MemberQuotaOverview, error) {
	if s == nil || s.organizations == nil || s.members == nil || s.quotaRequests == nil {
		return nil, ErrServiceUnavailable
	}
	summary, err := s.organizations.GetSummaryByUserID(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	if summary == nil || summary.IsOwner {
		return nil, nil
	}
	member, err := s.members.Get(ctx, summary.ID, actorUserID)
	if err != nil {
		return nil, err
	}
	// 到期未推进的行先推进，成员看到的剩余与重置时间才是真的。
	advanced := []OrganizationMember{*member}
	s.AdvanceDueQuotas(ctx, advanced)
	member = &advanced[0]

	now := time.Now()
	state := member.QuotaState(now)
	overview := &MemberQuotaOverview{
		Remaining:   member.SpendingRemainingAt(now),
		WindowEnd:   state.WindowEnd,
		RequestMode: QuotaRequestModeOff,
	}
	policy, err := s.quotaRequests.GetPolicy(ctx, summary.ID)
	if err != nil {
		return nil, err
	}
	if policy != nil {
		overview.RequestMode = policy.Mode
		overview.MinAmount = policy.Min
		overview.MaxAmount = policy.Max
	}
	if member.Status != StatusActive {
		return overview, nil
	}
	// 不限额的成员没有「再要一点」的对象；组织关闭申请时只剩数字。
	if member.EffectiveSpendingLimit(now) == nil || !policy.Enabled() {
		return overview, nil
	}
	overview.CanRequest = true
	pending, err := s.quotaRequests.HasPending(ctx, summary.ID, actorUserID)
	if err != nil {
		return nil, err
	}
	overview.PendingExists = pending
	return overview, nil
}

// MemberQuotaOverview 是仪表盘「组织配额」卡的数据块。
// Remaining 为 nil 表示不限额；CanRequest 表示申请按钮是否出现。
type MemberQuotaOverview struct {
	Remaining     *float64
	WindowEnd     *time.Time
	CanRequest    bool
	RequestMode   string
	MinAmount     *float64
	MaxAmount     *float64
	PendingExists bool
}

// requireOrdinaryMember 确认调用者是某组织的普通成员（不是创建者）。
// 看自己的申请流水、撤回待处理单用这条，不要求当前还能申请。
func (s *OrganizationMemberService) requireOrdinaryMember(
	ctx context.Context,
	actorUserID int64,
) (*OrganizationMember, error) {
	if s == nil || s.organizations == nil || s.members == nil {
		return nil, ErrServiceUnavailable
	}
	summary, err := s.organizations.GetSummaryByUserID(ctx, actorUserID)
	if err != nil {
		return nil, err
	}
	if summary == nil {
		return nil, ErrOrganizationQuotaRequestMemberIneligible
	}
	member, err := s.members.Get(ctx, summary.ID, actorUserID)
	if err != nil {
		return nil, err
	}
	if member == nil || member.IsOwner {
		return nil, ErrOrganizationQuotaRequestMemberIneligible
	}
	return member, nil
}

// requireRequestingMember 确认调用者是某组织的普通成员、账号启用且当前有限额，
// 返回成员与组织申请策略。任何一步不满足都给出稳定的业务错误。
func (s *OrganizationMemberService) requireRequestingMember(
	ctx context.Context,
	actorUserID int64,
) (*OrganizationMember, *OrganizationQuotaRequestPolicy, error) {
	if s == nil || s.organizations == nil || s.members == nil || s.quotaRequests == nil {
		return nil, nil, ErrServiceUnavailable
	}
	summary, err := s.organizations.GetSummaryByUserID(ctx, actorUserID)
	if err != nil {
		return nil, nil, err
	}
	if summary == nil {
		return nil, nil, ErrOrganizationQuotaRequestMemberIneligible
	}
	member, err := s.members.Get(ctx, summary.ID, actorUserID)
	if err != nil {
		return nil, nil, err
	}
	if member == nil || member.IsOwner || member.Status != StatusActive {
		return nil, nil, ErrOrganizationQuotaRequestMemberIneligible
	}
	if member.EffectiveSpendingLimit(time.Now()) == nil {
		// 不限额的成员不能申请：申请是往现有额度上追加，没有可追加的对象。
		return nil, nil, ErrOrganizationQuotaRequestMemberIneligible
	}
	policy, err := s.quotaRequests.GetPolicy(ctx, summary.ID)
	if err != nil {
		return nil, nil, err
	}
	return member, policy, nil
}

// requireReviewableRequest 确认调用者是组织创建者，且这笔申请属于本组织、仍在待处理。
func (s *OrganizationMemberService) requireReviewableRequest(
	ctx context.Context,
	actorUserID int64,
	requestID int64,
) (*OrganizationSummary, *OrganizationQuotaRequest, error) {
	summary, err := s.requireOwnedOrganization(ctx, actorUserID)
	if err != nil {
		return nil, nil, err
	}
	if requestID <= 0 {
		return nil, nil, ErrOrganizationQuotaRequestNotFound
	}
	request, err := s.quotaRequests.Get(ctx, summary.ID, requestID)
	if err != nil {
		return nil, nil, err
	}
	if request.Status != QuotaRequestStatusPending {
		return nil, nil, ErrOrganizationQuotaRequestNotPending
	}
	return summary, request, nil
}

func normalizeQuotaRequestStatus(status string) string {
	switch status {
	case QuotaRequestStatusPending, QuotaRequestStatusGranted,
		QuotaRequestStatusRejected, QuotaRequestStatusWithdrawn:
		return status
	default:
		return ""
	}
}

func stringPtr(value string) *string {
	return &value
}

type memberQuotaSnapshot struct {
	mode  string
	limit *float64
	used  float64
}

func snapshotFromMember(member *OrganizationMember, state MemberQuotaState) memberQuotaSnapshot {
	snapshot := memberQuotaSnapshot{
		mode:  string(state.Mode),
		limit: member.SpendingLimit,
		used:  member.SpendingUsed,
	}
	if state.Mode == QuotaModeActive && state.Amount != nil {
		snapshot.limit = state.Amount
	}
	return snapshot
}

// applyQuotaTopUp 把一笔追加金额套到成员身上（内存对象）：
// 周期生效中只补当期（本期一次性加成），其余情况加静态上限。
// 已用、冻结不动。落库由仓储在同一事务里完成。
func applyQuotaTopUp(member *OrganizationMember, amount float64, now time.Time) {
	state := member.QuotaState(now)
	if state.Mode == QuotaModeActive {
		member.QuotaCycleBonus = QuantizeUsageBillingAmount(member.QuotaCycleBonus + amount)
		return
	}
	if member.SpendingLimit == nil {
		// 调用方已确保有限额；这里兜底，避免空指针。
		limit := QuantizeUsageBillingAmount(amount)
		member.SpendingLimit = &limit
		return
	}
	limit := QuantizeUsageBillingAmount(*member.SpendingLimit + amount)
	member.SpendingLimit = &limit
}
