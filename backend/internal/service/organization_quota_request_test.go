package service

import (
	"context"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"

	"github.com/stretchr/testify/require"
)

// organizationQuotaRequestRepoStub 内存实现配额申请仓储，发放语义与真实仓储一致：
// 通过 / 即申即加走 applyQuotaTopUp（周期生效进当期加成，其余进静态上限），
// 成员不限额时申请自动作废为已驳回。
type organizationQuotaRequestRepoStub struct {
	organizationID int64
	policy         *OrganizationQuotaRequestPolicy
	requests       map[int64]*OrganizationQuotaRequest
	nextID         int64
	members        *organizationMemberRepoStub
}

func (r *organizationQuotaRequestRepoStub) GetPolicy(
	_ context.Context,
	organizationID int64,
) (*OrganizationQuotaRequestPolicy, error) {
	if organizationID != r.organizationID {
		return nil, ErrOrganizationNotFound
	}
	policy := *r.policy
	return &policy, nil
}

func (r *organizationQuotaRequestRepoStub) UpdatePolicy(
	_ context.Context,
	organizationID int64,
	policy OrganizationQuotaRequestPolicy,
) error {
	if organizationID != r.organizationID {
		return ErrOrganizationNotFound
	}
	saved := policy
	r.policy = &saved
	return nil
}

func (r *organizationQuotaRequestRepoStub) Create(_ context.Context, request *OrganizationQuotaRequest) error {
	if request.OrganizationID != r.organizationID {
		return ErrOrganizationQuotaRequestNotFound
	}
	r.nextID++
	request.ID = r.nextID
	request.CreatedAt = time.Now()
	stored := *request
	r.requests[stored.ID] = &stored
	return nil
}

func (r *organizationQuotaRequestRepoStub) CreateAutoGranted(
	ctx context.Context,
	request *OrganizationQuotaRequest,
	_ *OrganizationMember,
) error {
	if err := r.Create(ctx, request); err != nil {
		return err
	}
	// 与真实仓储一致：发放作用于存储的成员行（服务侧的对象是一份拷贝）。
	applyQuotaTopUp(r.members.members[request.UserID], request.Amount, time.Now())
	return nil
}

func (r *organizationQuotaRequestRepoStub) Get(
	_ context.Context,
	organizationID int64,
	requestID int64,
) (*OrganizationQuotaRequest, error) {
	if organizationID != r.organizationID {
		return nil, ErrOrganizationQuotaRequestNotFound
	}
	request, ok := r.requests[requestID]
	if !ok {
		return nil, ErrOrganizationQuotaRequestNotFound
	}
	stored := *request
	return &stored, nil
}

func (r *organizationQuotaRequestRepoStub) ListByOrganization(
	_ context.Context,
	organizationID int64,
	_ pagination.PaginationParams,
	filters OrganizationQuotaRequestListFilters,
) ([]OrganizationQuotaRequest, *pagination.PaginationResult, error) {
	if organizationID != r.organizationID {
		return nil, nil, ErrOrganizationNotFound
	}
	return r.list(filters)
}

func (r *organizationQuotaRequestRepoStub) ListByUser(
	_ context.Context,
	userID int64,
	_ pagination.PaginationParams,
	filters OrganizationQuotaRequestListFilters,
) ([]OrganizationQuotaRequest, *pagination.PaginationResult, error) {
	out := make([]OrganizationQuotaRequest, 0)
	for _, request := range r.requests {
		if request.UserID != userID {
			continue
		}
		if filters.Status != "" && request.Status != filters.Status {
			continue
		}
		out = append(out, *request)
	}
	return out, &pagination.PaginationResult{Total: int64(len(out)), Page: 1, PageSize: 20, Pages: 1}, nil
}

func (r *organizationQuotaRequestRepoStub) list(
	filters OrganizationQuotaRequestListFilters,
) ([]OrganizationQuotaRequest, *pagination.PaginationResult, error) {
	out := make([]OrganizationQuotaRequest, 0)
	for _, request := range r.requests {
		if filters.Status != "" && request.Status != filters.Status {
			continue
		}
		out = append(out, *request)
	}
	return out, &pagination.PaginationResult{Total: int64(len(out)), Page: 1, PageSize: 20, Pages: 1}, nil
}

func (r *organizationQuotaRequestRepoStub) HasPending(
	_ context.Context,
	organizationID int64,
	userID int64,
) (bool, error) {
	if organizationID != r.organizationID {
		return false, ErrOrganizationNotFound
	}
	for _, request := range r.requests {
		if request.UserID == userID && request.Status == QuotaRequestStatusPending {
			return true, nil
		}
	}
	return false, nil
}

func (r *organizationQuotaRequestRepoStub) Review(
	_ context.Context,
	organizationID int64,
	requestID int64,
	review OrganizationQuotaRequestReview,
) (*OrganizationQuotaRequest, *OrganizationMember, error) {
	if organizationID != r.organizationID {
		return nil, nil, ErrOrganizationQuotaRequestNotFound
	}
	request, ok := r.requests[requestID]
	if !ok {
		return nil, nil, ErrOrganizationQuotaRequestNotFound
	}
	if request.Status != QuotaRequestStatusPending {
		return nil, nil, ErrOrganizationQuotaRequestNotPending
	}

	var updatedMember *OrganizationMember
	voided := false
	if review.Status == QuotaRequestStatusGranted {
		member, ok := r.members.members[request.UserID]
		if !ok || member.EffectiveSpendingLimit(time.Now()) == nil {
			// 与真实仓储一致：成员已不限额（或不在了），申请作废为已驳回。
			voided = true
			review.Status = QuotaRequestStatusRejected
			if review.ReviewNote == "" {
				review.ReviewNote = "member is no longer eligible; request voided"
			}
			review.GrantSource = nil
			review.GrantedAmount = nil
		} else {
			applyQuotaTopUp(member, request.Amount, time.Now())
			updatedMember = member
		}
	}

	request.Status = review.Status
	request.GrantSource = review.GrantSource
	request.GrantedAmount = review.GrantedAmount
	request.ReviewerUserID = review.ReviewerUserID
	request.ReviewNote = review.ReviewNote
	request.ReviewedAt = &time.Time{}
	stored := *request
	if voided {
		return &stored, nil, ErrOrganizationQuotaRequestMemberIneligible
	}
	return &stored, updatedMember, nil
}

func TestValidateQuotaRequestPolicy(t *testing.T) {
	t.Run("off 清空最低最高", func(t *testing.T) {
		policy, err := ValidateQuotaRequestPolicy(QuotaRequestModeOff, spendingLimitPtr(5), spendingLimitPtr(10))
		require.NoError(t, err)
		require.Equal(t, QuotaRequestModeOff, policy.Mode)
		require.Nil(t, policy.Min)
		require.Nil(t, policy.Max)
	})

	t.Run("打开后两项必填且最高不低于最低", func(t *testing.T) {
		for _, mode := range []string{QuotaRequestModeApprove, QuotaRequestModeAuto} {
			_, err := ValidateQuotaRequestPolicy(mode, nil, spendingLimitPtr(10))
			require.ErrorIs(t, err, ErrOrganizationQuotaRequestRangeInvalid)
			_, err = ValidateQuotaRequestPolicy(mode, spendingLimitPtr(1), nil)
			require.ErrorIs(t, err, ErrOrganizationQuotaRequestRangeInvalid)
			_, err = ValidateQuotaRequestPolicy(mode, spendingLimitPtr(0), spendingLimitPtr(10))
			require.ErrorIs(t, err, ErrOrganizationQuotaRequestRangeInvalid)
			_, err = ValidateQuotaRequestPolicy(mode, spendingLimitPtr(10), spendingLimitPtr(5))
			require.ErrorIs(t, err, ErrOrganizationQuotaRequestRangeInvalid)
			_, err = ValidateQuotaRequestPolicy("sometimes", spendingLimitPtr(1), spendingLimitPtr(10))
			require.ErrorIs(t, err, ErrOrganizationQuotaRequestModeInvalid)
		}
	})

	t.Run("按计费精度取整", func(t *testing.T) {
		policy, err := ValidateQuotaRequestPolicy(QuotaRequestModeApprove, spendingLimitPtr(1.000000001), spendingLimitPtr(5.000000009))
		require.NoError(t, err)
		require.Equal(t, 1.0, *policy.Min)
		require.Equal(t, 5.00000001, *policy.Max)
	})
}

func TestOrganizationQuotaRequestPolicyUpdate(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()

	policy, err := fixture.service.UpdateQuotaRequestPolicy(
		ctx, testOrganizationOwnerID, QuotaRequestModeApprove, spendingLimitPtr(1), spendingLimitPtr(50),
	)
	require.NoError(t, err)
	require.Equal(t, QuotaRequestModeApprove, policy.Mode)
	require.Equal(t, 1.0, *policy.Min)
	require.Equal(t, 50.0, *policy.Max)

	_, err = fixture.service.UpdateQuotaRequestPolicy(
		ctx, testOrganizationMemberID, QuotaRequestModeAuto, spendingLimitPtr(1), spendingLimitPtr(50),
	)
	require.ErrorIs(t, err, ErrOrganizationOwnerRequired, "普通成员不能改申请策略")
}

func TestOrganizationQuotaRequestSubmit(t *testing.T) {
	t.Run("关闭时拒绝提交", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		fixture.members.members[testOrganizationMemberID].SpendingLimit = spendingLimitPtr(10)
		_, err := fixture.service.SubmitQuotaRequest(context.Background(), testOrganizationMemberID, 5, "")
		require.ErrorIs(t, err, ErrOrganizationQuotaRequestDisabled)
	})

	t.Run("金额必须落在最低最高闭区间", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		fixture.members.members[testOrganizationMemberID].SpendingLimit = spendingLimitPtr(10)
		fixture.quotaRequests.policy = &OrganizationQuotaRequestPolicy{
			Mode: QuotaRequestModeApprove, Min: spendingLimitPtr(1), Max: spendingLimitPtr(50),
		}
		ctx := context.Background()
		_, err := fixture.service.SubmitQuotaRequest(ctx, testOrganizationMemberID, 0.5, "")
		require.ErrorIs(t, err, ErrOrganizationQuotaRequestAmountInvalid)
		_, err = fixture.service.SubmitQuotaRequest(ctx, testOrganizationMemberID, 51, "")
		require.ErrorIs(t, err, ErrOrganizationQuotaRequestAmountInvalid)
		_, err = fixture.service.SubmitQuotaRequest(ctx, testOrganizationMemberID, 0, "")
		require.ErrorIs(t, err, ErrOrganizationQuotaRequestAmountInvalid)
	})

	t.Run("组织管理员与不限额或停用成员不能申请", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		fixture.quotaRequests.policy = &OrganizationQuotaRequestPolicy{
			Mode: QuotaRequestModeApprove, Min: spendingLimitPtr(1), Max: spendingLimitPtr(50),
		}
		ctx := context.Background()
		_, err := fixture.service.SubmitQuotaRequest(ctx, testOrganizationOwnerID, 5, "")
		require.ErrorIs(t, err, ErrOrganizationQuotaRequestMemberIneligible, "组织管理员没有成员额度")

		fixture.members.members[testOrganizationOtherID].SpendingLimit = nil
		_, err = fixture.service.SubmitQuotaRequest(ctx, testOrganizationOtherID, 5, "")
		require.ErrorIs(t, err, ErrOrganizationQuotaRequestMemberIneligible, "不限额成员没有追加对象")

		fixture.members.members[testOrganizationAdminID].SpendingLimit = spendingLimitPtr(10)
		fixture.members.members[testOrganizationAdminID].Status = StatusDisabled
		_, err = fixture.service.SubmitQuotaRequest(ctx, testOrganizationAdminID, 5, "")
		require.ErrorIs(t, err, ErrOrganizationQuotaRequestMemberIneligible, "停用成员不能申请")
	})

	t.Run("先批后加只记待处理且每人一笔", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		fixture.members.members[testOrganizationMemberID].SpendingLimit = spendingLimitPtr(10)
		fixture.members.members[testOrganizationMemberID].SpendingUsed = 3
		fixture.quotaRequests.policy = &OrganizationQuotaRequestPolicy{
			Mode: QuotaRequestModeApprove, Min: spendingLimitPtr(1), Max: spendingLimitPtr(50),
		}
		ctx := context.Background()

		request, err := fixture.service.SubmitQuotaRequest(ctx, testOrganizationMemberID, 5, "need more")
		require.NoError(t, err)
		require.Equal(t, QuotaRequestStatusPending, request.Status)
		require.Equal(t, string(QuotaModeStatic), request.SnapshotMode)
		require.Equal(t, 10.0, *request.SnapshotLimit, "快照记录提交时的上限")
		require.Equal(t, 3.0, request.SnapshotUsed)
		require.Equal(t, 10.0, *fixture.members.members[testOrganizationMemberID].SpendingLimit, "待处理期间额度不动")

		_, err = fixture.service.SubmitQuotaRequest(ctx, testOrganizationMemberID, 5, "")
		require.ErrorIs(t, err, ErrOrganizationQuotaRequestPendingExists)
	})

	t.Run("即申即加静态成员直接加上限并留档", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		fixture.members.members[testOrganizationMemberID].SpendingLimit = spendingLimitPtr(10)
		fixture.quotaRequests.policy = &OrganizationQuotaRequestPolicy{
			Mode: QuotaRequestModeAuto, Min: spendingLimitPtr(1), Max: spendingLimitPtr(50),
		}
		ctx := context.Background()

		request, err := fixture.service.SubmitQuotaRequest(ctx, testOrganizationMemberID, 5, "")
		require.NoError(t, err)
		require.Equal(t, QuotaRequestStatusGranted, request.Status)
		require.NotNil(t, request.GrantSource)
		require.Equal(t, QuotaRequestSourceAuto, *request.GrantSource)
		require.Equal(t, 15.0, *fixture.members.members[testOrganizationMemberID].SpendingLimit)
		require.Equal(t, []int64{testOrganizationMemberID}, fixture.authCache.invalidatedUserIDs, "发放后清鉴权缓存")
	})

	t.Run("即申即加周期成员只补当期", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		now := time.Now()
		cycleStart := now.Add(-2 * 24 * time.Hour)
		amount := 50.0
		periodDays := 30
		member := fixture.members.members[testOrganizationMemberID]
		member.QuotaAmount = &amount
		member.QuotaPeriodDays = &periodDays
		member.QuotaStartAt = &cycleStart
		member.QuotaCycleStart = &cycleStart
		fixture.quotaRequests.policy = &OrganizationQuotaRequestPolicy{
			Mode: QuotaRequestModeAuto, Min: spendingLimitPtr(1), Max: spendingLimitPtr(50),
		}
		ctx := context.Background()

		request, err := fixture.service.SubmitQuotaRequest(ctx, testOrganizationMemberID, 10, "")
		require.NoError(t, err)
		require.Equal(t, string(QuotaModeActive), request.SnapshotMode)
		require.Equal(t, 50.0, *request.SnapshotLimit, "周期成员快照记录每期金额")
		require.Equal(t, 10.0, member.QuotaCycleBonus, "加成进当期")
		require.Equal(t, 50.0, *member.QuotaAmount, "每期金额不变")
		require.Nil(t, member.SpendingLimit, "静态上限不动")
		require.Equal(t, 60.0, *member.EffectiveSpendingLimit(now), "生效上限 = 每期金额 + 加成")
	})
}

func TestOrganizationQuotaRequestReview(t *testing.T) {
	newPending := func(t *testing.T) *organizationMemberFixture {
		t.Helper()
		fixture := newOrganizationMemberFixture(t)
		fixture.members.members[testOrganizationMemberID].SpendingLimit = spendingLimitPtr(10)
		fixture.quotaRequests.policy = &OrganizationQuotaRequestPolicy{
			Mode: QuotaRequestModeApprove, Min: spendingLimitPtr(1), Max: spendingLimitPtr(50),
		}
		request, err := fixture.service.SubmitQuotaRequest(context.Background(), testOrganizationMemberID, 5, "need more")
		require.NoError(t, err)
		require.NotZero(t, request.ID)
		return fixture
	}

	t.Run("普通成员不能审批", func(t *testing.T) {
		fixture := newPending(t)
		var requestID int64
		for id := range fixture.quotaRequests.requests {
			requestID = id
		}
		_, err := fixture.service.ApproveQuotaRequest(context.Background(), testOrganizationOtherID, requestID, "")
		require.ErrorIs(t, err, ErrOrganizationOwnerRequired)
	})

	t.Run("通过后静态上限加上这笔", func(t *testing.T) {
		fixture := newPending(t)
		var requestID int64
		for id := range fixture.quotaRequests.requests {
			requestID = id
		}
		ctx := context.Background()

		updated, err := fixture.service.ApproveQuotaRequest(ctx, testOrganizationOwnerID, requestID, "ok")
		require.NoError(t, err)
		require.Equal(t, QuotaRequestStatusGranted, updated.Status)
		require.NotNil(t, updated.GrantSource)
		require.Equal(t, QuotaRequestSourceManual, *updated.GrantSource)
		require.Equal(t, 5.0, *updated.GrantedAmount)
		require.Equal(t, 15.0, *fixture.members.members[testOrganizationMemberID].SpendingLimit)
		require.Equal(t, []int64{testOrganizationMemberID}, fixture.authCache.invalidatedUserIDs, "通过后清鉴权缓存")
	})

	t.Run("成员变不限额时通过会自动作废且额度不动", func(t *testing.T) {
		fixture := newPending(t)
		var requestID int64
		for id := range fixture.quotaRequests.requests {
			requestID = id
		}
		fixture.members.members[testOrganizationMemberID].SpendingLimit = nil

		updated, err := fixture.service.ApproveQuotaRequest(context.Background(), testOrganizationOwnerID, requestID, "")
		require.ErrorIs(t, err, ErrOrganizationQuotaRequestMemberIneligible)
		require.Equal(t, QuotaRequestStatusRejected, updated.Status)
		require.Nil(t, fixture.members.members[testOrganizationMemberID].SpendingLimit, "额度不动")
	})

	t.Run("非待处理不能再审", func(t *testing.T) {
		fixture := newPending(t)
		var requestID int64
		for id := range fixture.quotaRequests.requests {
			requestID = id
		}
		ctx := context.Background()
		_, err := fixture.service.RejectQuotaRequest(ctx, testOrganizationOwnerID, requestID, "no")
		require.NoError(t, err)
		_, err = fixture.service.ApproveQuotaRequest(ctx, testOrganizationOwnerID, requestID, "")
		require.ErrorIs(t, err, ErrOrganizationQuotaRequestNotPending)
	})

	t.Run("驳回留原因额度不动", func(t *testing.T) {
		fixture := newPending(t)
		var requestID int64
		for id := range fixture.quotaRequests.requests {
			requestID = id
		}
		updated, err := fixture.service.RejectQuotaRequest(context.Background(), testOrganizationOwnerID, requestID, "budget")
		require.NoError(t, err)
		require.Equal(t, QuotaRequestStatusRejected, updated.Status)
		require.Equal(t, "budget", updated.ReviewNote)
		require.Equal(t, 10.0, *fixture.members.members[testOrganizationMemberID].SpendingLimit)
	})

	t.Run("成员只能撤自己的待处理单", func(t *testing.T) {
		fixture := newPending(t)
		fixture.members.members[testOrganizationOtherID].SpendingLimit = spendingLimitPtr(20)
		var requestID int64
		for id := range fixture.quotaRequests.requests {
			requestID = id
		}
		ctx := context.Background()

		_, err := fixture.service.WithdrawQuotaRequest(ctx, testOrganizationOtherID, requestID)
		require.ErrorIs(t, err, ErrOrganizationQuotaRequestNotFound)

		updated, err := fixture.service.WithdrawQuotaRequest(ctx, testOrganizationMemberID, requestID)
		require.NoError(t, err)
		require.Equal(t, QuotaRequestStatusWithdrawn, updated.Status)
		require.Equal(t, 10.0, *fixture.members.members[testOrganizationMemberID].SpendingLimit, "撤回不动额度")
	})
}

func TestGetMyQuotaOverview(t *testing.T) {
	t.Run("组织管理员没有配额卡", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		overview, err := fixture.service.GetMyQuotaOverview(context.Background(), testOrganizationOwnerID)
		require.NoError(t, err)
		require.Nil(t, overview)
	})

	t.Run("不限额成员看到不限额且不能申请", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		fixture.quotaRequests.policy = &OrganizationQuotaRequestPolicy{
			Mode: QuotaRequestModeAuto, Min: spendingLimitPtr(1), Max: spendingLimitPtr(50),
		}
		overview, err := fixture.service.GetMyQuotaOverview(context.Background(), testOrganizationMemberID)
		require.NoError(t, err)
		require.NotNil(t, overview)
		require.Nil(t, overview.Remaining)
		require.False(t, overview.CanRequest)
	})

	t.Run("有限额成员按策略出现申请入口", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		member := fixture.members.members[testOrganizationMemberID]
		member.SpendingLimit = spendingLimitPtr(10)
		member.SpendingUsed = 4
		fixture.quotaRequests.policy = &OrganizationQuotaRequestPolicy{
			Mode: QuotaRequestModeApprove, Min: spendingLimitPtr(1), Max: spendingLimitPtr(50),
		}
		overview, err := fixture.service.GetMyQuotaOverview(context.Background(), testOrganizationMemberID)
		require.NoError(t, err)
		require.NotNil(t, overview)
		require.Equal(t, 6.0, *overview.Remaining)
		require.True(t, overview.CanRequest)
		require.Equal(t, 1.0, *overview.MinAmount)
		require.Equal(t, 50.0, *overview.MaxAmount)
	})

	t.Run("周期成员带本期截止时间", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		now := time.Now()
		cycleStart := now.Add(-2 * 24 * time.Hour)
		amount := 50.0
		periodDays := 30
		member := fixture.members.members[testOrganizationMemberID]
		member.QuotaAmount = &amount
		member.QuotaPeriodDays = &periodDays
		member.QuotaStartAt = &cycleStart
		member.QuotaCycleStart = &cycleStart
		fixture.quotaRequests.policy = &OrganizationQuotaRequestPolicy{
			Mode: QuotaRequestModeApprove, Min: spendingLimitPtr(1), Max: spendingLimitPtr(50),
		}
		overview, err := fixture.service.GetMyQuotaOverview(context.Background(), testOrganizationMemberID)
		require.NoError(t, err)
		require.NotNil(t, overview)
		require.NotNil(t, overview.WindowEnd, "周期生效中带本期截止")
		require.True(t, overview.WindowEnd.After(now))
		require.True(t, overview.CanRequest)
	})

	t.Run("关闭申请时只剩数字", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		fixture.members.members[testOrganizationMemberID].SpendingLimit = spendingLimitPtr(10)
		overview, err := fixture.service.GetMyQuotaOverview(context.Background(), testOrganizationMemberID)
		require.NoError(t, err)
		require.NotNil(t, overview)
		require.Equal(t, 10.0, *overview.Remaining)
		require.False(t, overview.CanRequest)
	})

	t.Run("换期后仪表盘剩余不含上期加成", func(t *testing.T) {
		fixture := newOrganizationMemberFixture(t)
		now := time.Now()
		startAt := now.Add(-40 * 24 * time.Hour)
		amount := 50.0
		periodDays := 30
		member := fixture.members.members[testOrganizationMemberID]
		member.QuotaAmount = &amount
		member.QuotaPeriodDays = &periodDays
		member.QuotaStartAt = &startAt
		member.QuotaCycleStart = &startAt
		member.SpendingUsed = 40
		member.QuotaCycleBonus = 10
		overview, err := fixture.service.GetMyQuotaOverview(context.Background(), testOrganizationMemberID)
		require.NoError(t, err)
		require.NotNil(t, overview)
		require.Equal(t, 50.0, *overview.Remaining, "换期后已用清零、加成清零，剩余等于每期金额")
		require.Zero(t, fixture.members.members[testOrganizationMemberID].QuotaCycleBonus)
	})
}

func TestListQuotaRequestsAllowsUnlimitedMember(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	fixture.members.members[testOrganizationMemberID].SpendingLimit = spendingLimitPtr(10)
	fixture.quotaRequests.policy = &OrganizationQuotaRequestPolicy{
		Mode: QuotaRequestModeApprove, Min: spendingLimitPtr(1), Max: spendingLimitPtr(50),
	}
	ctx := context.Background()
	_, err := fixture.service.SubmitQuotaRequest(ctx, testOrganizationMemberID, 5, "need more")
	require.NoError(t, err)

	fixture.members.members[testOrganizationMemberID].SpendingLimit = nil
	items, result, err := fixture.service.ListQuotaRequests(
		ctx, testOrganizationMemberID, pagination.PaginationParams{Page: 1, PageSize: 20}, OrganizationQuotaRequestListFilters{},
	)
	require.NoError(t, err, "不限额成员仍能看自己的申请流水")
	require.Equal(t, int64(1), result.Total)
	require.Len(t, items, 1)
	require.Equal(t, QuotaRequestStatusPending, items[0].Status)
}
