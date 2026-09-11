package service

import (
	"context"
	"sort"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"

	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/require"
)

type organizationMemberRepoStub struct {
	organizationID int64
	members        map[int64]*OrganizationMember
	writes         [][]OrganizationMemberSpendingLimit
	listFilters    []OrganizationMemberListFilters
}

func (r *organizationMemberRepoStub) List(
	_ context.Context,
	organizationID int64,
	params pagination.PaginationParams,
	filters OrganizationMemberListFilters,
) ([]OrganizationMember, *pagination.PaginationResult, error) {
	r.listFilters = append(r.listFilters, filters)
	if organizationID != r.organizationID {
		return nil, nil, ErrOrganizationNotFound
	}
	out := make([]OrganizationMember, 0, len(r.members))
	for _, member := range r.members {
		out = append(out, *member)
	}
	return out, &pagination.PaginationResult{
		Total:    int64(len(out)),
		Page:     params.Page,
		PageSize: params.Limit(),
		Pages:    1,
	}, nil
}

func (r *organizationMemberRepoStub) Get(_ context.Context, organizationID int64, userID int64) (*OrganizationMember, error) {
	if organizationID != r.organizationID {
		return nil, ErrOrganizationMemberNotFound
	}
	member, ok := r.members[userID]
	if !ok {
		return nil, ErrOrganizationMemberNotFound
	}
	copyValue := *member
	return &copyValue, nil
}

func (r *organizationMemberRepoStub) SetSpendingLimits(
	_ context.Context,
	organizationID int64,
	limits []OrganizationMemberSpendingLimit,
) error {
	if organizationID != r.organizationID {
		return ErrOrganizationMemberNotFound
	}
	for _, limit := range limits {
		if _, ok := r.members[limit.UserID]; !ok {
			return ErrOrganizationMemberNotFound
		}
	}
	for _, limit := range limits {
		r.members[limit.UserID].SpendingLimit = limit.Limit
	}
	r.writes = append(r.writes, limits)
	return nil
}

func (r *organizationMemberRepoStub) ListUserIDs(_ context.Context, organizationID int64) ([]int64, error) {
	if organizationID != r.organizationID {
		return nil, ErrOrganizationNotFound
	}
	out := make([]int64, 0, len(r.members))
	for userID := range r.members {
		out = append(out, userID)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out, nil
}

type organizationMemberUserRepoStub struct {
	UserRepository
	users   map[int64]*User
	updated map[int64]UserUpdateFields
}

func (r *organizationMemberUserRepoStub) GetByID(_ context.Context, id int64) (*User, error) {
	user, ok := r.users[id]
	if !ok {
		return nil, ErrUserNotFound
	}
	copyValue := *user
	return &copyValue, nil
}

func (r *organizationMemberUserRepoStub) Update(_ context.Context, user *User, fields UserUpdateFields) error {
	if _, ok := r.users[user.ID]; !ok {
		return ErrUserNotFound
	}
	copyValue := *user
	r.users[user.ID] = &copyValue
	if r.updated == nil {
		r.updated = map[int64]UserUpdateFields{}
	}
	r.updated[user.ID] = fields
	return nil
}

type organizationAuthCacheStub struct {
	invalidatedUserIDs []int64
}

func (s *organizationAuthCacheStub) InvalidateAuthCacheByKey(_ context.Context, _ string) {}

func (s *organizationAuthCacheStub) InvalidateAuthCacheByUserID(_ context.Context, userID int64) {
	s.invalidatedUserIDs = append(s.invalidatedUserIDs, userID)
}

func (s *organizationAuthCacheStub) InvalidateAuthCacheByGroupID(_ context.Context, _ int64) {}

func spendingLimitPtr(value float64) *float64 {
	return &value
}

const (
	testOrganizationOwnerID  = int64(1)
	testOrganizationMemberID = int64(2)
	testOrganizationOtherID  = int64(3)
	testOrganizationAdminID  = int64(4)
)

type organizationMemberFixture struct {
	service   *OrganizationMemberService
	members   *organizationMemberRepoStub
	users     *organizationMemberUserRepoStub
	authCache *organizationAuthCacheStub
}

func newOrganizationMemberFixture(t *testing.T) *organizationMemberFixture {
	t.Helper()

	organizationRepo := newOrganizationRepoStub()
	organization := &Organization{Name: "Acme", OwnerUserID: testOrganizationOwnerID}
	require.NoError(t, organizationRepo.Create(context.Background(), organization))
	for _, userID := range []int64{
		testOrganizationOwnerID,
		testOrganizationMemberID,
		testOrganizationOtherID,
		testOrganizationAdminID,
	} {
		require.NoError(t, organizationRepo.CreateMember(context.Background(), &OrganizationMembership{
			OrganizationID: organization.ID,
			UserID:         userID,
		}))
	}

	joinedAt := time.Now().UTC()
	members := &organizationMemberRepoStub{
		organizationID: organization.ID,
		members: map[int64]*OrganizationMember{
			testOrganizationOwnerID: {
				UserID: testOrganizationOwnerID, Email: "owner@acme.test", Status: StatusActive,
				Role: RoleUser, IsOwner: true, JoinedAt: joinedAt,
			},
			testOrganizationMemberID: {
				UserID: testOrganizationMemberID, Email: "member@acme.test", Status: StatusActive,
				Role: RoleUser, JoinedAt: joinedAt,
			},
			testOrganizationOtherID: {
				UserID: testOrganizationOtherID, Email: "other@acme.test", Status: StatusActive,
				Role: RoleUser, JoinedAt: joinedAt,
			},
			testOrganizationAdminID: {
				UserID: testOrganizationAdminID, Email: "platform-admin@acme.test", Status: StatusActive,
				Role: RoleAdmin, JoinedAt: joinedAt,
			},
		},
	}
	users := &organizationMemberUserRepoStub{users: map[int64]*User{
		testOrganizationOwnerID:  {ID: testOrganizationOwnerID, Status: StatusActive, Role: RoleUser},
		testOrganizationMemberID: {ID: testOrganizationMemberID, Status: StatusActive, Role: RoleUser},
		testOrganizationOtherID:  {ID: testOrganizationOtherID, Status: StatusActive, Role: RoleUser},
		testOrganizationAdminID:  {ID: testOrganizationAdminID, Status: StatusActive, Role: RoleAdmin},
	}}
	authCache := &organizationAuthCacheStub{}

	return &organizationMemberFixture{
		service: NewOrganizationMemberService(
			NewOrganizationService(organizationRepo, newOrganizationRedeemRepoStub()),
			members,
			users,
			authCache,
		),
		members:   members,
		users:     users,
		authCache: authCache,
	}
}

func TestOrganizationMemberServiceMemberUserIDs(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()

	memberIDs, err := fixture.service.MemberUserIDs(ctx, testOrganizationOwnerID)
	require.NoError(t, err)
	require.Equal(t, []int64{
		testOrganizationOwnerID,
		testOrganizationMemberID,
		testOrganizationOtherID,
		testOrganizationAdminID,
	}, memberIDs, "组织范围包含组织管理员本人")

	_, err = fixture.service.MemberUserIDs(ctx, testOrganizationMemberID)
	require.ErrorIs(t, err, ErrOrganizationOwnerRequired, "普通成员拿不到全组织范围")
}

func TestOrganizationMemberServiceRejectsNonOwner(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()

	_, _, err := fixture.service.List(ctx, testOrganizationMemberID, pagination.DefaultPagination(), OrganizationMemberListFilters{})
	require.ErrorIs(t, err, ErrOrganizationOwnerRequired)

	_, err = fixture.service.UpdateStatus(ctx, testOrganizationMemberID, testOrganizationOtherID, StatusDisabled)
	require.ErrorIs(t, err, ErrOrganizationOwnerRequired)

	_, err = fixture.service.UpdateSpendingLimit(ctx, testOrganizationMemberID, testOrganizationOtherID, spendingLimitPtr(10))
	require.ErrorIs(t, err, ErrOrganizationOwnerRequired)

	_, err = fixture.service.SplitSpendingLimit(ctx, testOrganizationMemberID, []int64{testOrganizationOtherID}, 10)
	require.ErrorIs(t, err, ErrOrganizationOwnerRequired)
	require.Empty(t, fixture.members.writes)
}

func TestOrganizationMemberServiceRejectsForeignMember(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()
	const foreignUserID = int64(99)

	_, err := fixture.service.UpdateStatus(ctx, testOrganizationOwnerID, foreignUserID, StatusDisabled)
	require.ErrorIs(t, err, ErrOrganizationMemberNotFound)

	_, err = fixture.service.UpdateSpendingLimit(ctx, testOrganizationOwnerID, foreignUserID, spendingLimitPtr(10))
	require.ErrorIs(t, err, ErrOrganizationMemberNotFound)

	_, err = fixture.service.SplitSpendingLimit(ctx, testOrganizationOwnerID, []int64{testOrganizationMemberID, foreignUserID}, 100)
	require.ErrorIs(t, err, ErrOrganizationMemberNotFound)
	require.Empty(t, fixture.members.writes, "一个目标非法时整笔均分都不应写入")
}

func TestOrganizationMemberServiceProtectsOwnerAndPlatformAdmin(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()

	_, err := fixture.service.UpdateStatus(ctx, testOrganizationOwnerID, testOrganizationOwnerID, StatusDisabled)
	require.ErrorIs(t, err, ErrOrganizationMemberOwnerImmutable)

	_, err = fixture.service.UpdateSpendingLimit(ctx, testOrganizationOwnerID, testOrganizationOwnerID, spendingLimitPtr(10))
	require.ErrorIs(t, err, ErrOrganizationMemberOwnerImmutable)

	_, err = fixture.service.SplitSpendingLimit(ctx, testOrganizationOwnerID, []int64{testOrganizationMemberID, testOrganizationOwnerID}, 100)
	require.ErrorIs(t, err, ErrOrganizationMemberOwnerImmutable)
	require.Empty(t, fixture.members.writes)

	_, err = fixture.service.UpdateStatus(ctx, testOrganizationOwnerID, testOrganizationAdminID, StatusDisabled)
	require.ErrorIs(t, err, ErrOrganizationMemberPlatformAdmin)
	require.Equal(t, StatusActive, fixture.users.users[testOrganizationAdminID].Status)
}

func TestOrganizationMemberServiceUpdateStatus(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()

	_, err := fixture.service.UpdateStatus(ctx, testOrganizationOwnerID, testOrganizationMemberID, "paused")
	require.ErrorIs(t, err, ErrOrganizationMemberStatusInvalid)

	member, err := fixture.service.UpdateStatus(ctx, testOrganizationOwnerID, testOrganizationMemberID, StatusDisabled)
	require.NoError(t, err)
	require.Equal(t, StatusDisabled, member.Status)
	require.Equal(t, StatusDisabled, fixture.users.users[testOrganizationMemberID].Status)
	require.Equal(t, UserUpdateFields{Status: true}, fixture.users.updated[testOrganizationMemberID])
	require.Equal(t, []int64{testOrganizationMemberID}, fixture.authCache.invalidatedUserIDs)

	// 停用不碰消费上限、已消费金额和成员关系。
	stored := fixture.members.members[testOrganizationMemberID]
	require.Nil(t, stored.SpendingLimit)
	require.Zero(t, stored.SpendingUsed)
}

func TestOrganizationMemberServiceUpdateSpendingLimit(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()

	_, err := fixture.service.UpdateSpendingLimit(ctx, testOrganizationOwnerID, testOrganizationMemberID, spendingLimitPtr(-1))
	require.ErrorIs(t, err, ErrOrganizationSpendingLimitInvalid)

	member, err := fixture.service.UpdateSpendingLimit(ctx, testOrganizationOwnerID, testOrganizationMemberID, spendingLimitPtr(12.123456789))
	require.NoError(t, err)
	require.NotNil(t, member.SpendingLimit)
	require.InDelta(t, 12.12345679, *member.SpendingLimit, 0)

	// 0 表示完全不能消费，不等于不限额。
	member, err = fixture.service.UpdateSpendingLimit(ctx, testOrganizationOwnerID, testOrganizationMemberID, spendingLimitPtr(0))
	require.NoError(t, err)
	require.NotNil(t, member.SpendingLimit)
	require.Zero(t, *member.SpendingLimit)
	require.NotNil(t, member.SpendingRemaining())
	require.Zero(t, *member.SpendingRemaining())

	// 传空改回不限额。
	member, err = fixture.service.UpdateSpendingLimit(ctx, testOrganizationOwnerID, testOrganizationMemberID, nil)
	require.NoError(t, err)
	require.Nil(t, member.SpendingLimit)
	require.Nil(t, member.SpendingRemaining())
	require.Nil(t, fixture.members.members[testOrganizationMemberID].SpendingLimit)
}

func TestOrganizationMemberSpendingLimitBelowUsedKeepsUsage(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()
	fixture.members.members[testOrganizationMemberID].SpendingUsed = 50

	member, err := fixture.service.UpdateSpendingLimit(ctx, testOrganizationOwnerID, testOrganizationMemberID, spendingLimitPtr(30))
	require.NoError(t, err)
	require.InDelta(t, 50, member.SpendingUsed, 0)
	require.NotNil(t, member.SpendingRemaining())
	require.Zero(t, *member.SpendingRemaining(), "上限低于已消费金额时剩余额度按 0 展示")
	require.InDelta(t, 50, fixture.members.members[testOrganizationMemberID].SpendingUsed, 0)
}

func TestOrganizationMemberSplitSpendingLimit(t *testing.T) {
	fixture := newOrganizationMemberFixture(t)
	ctx := context.Background()

	_, err := fixture.service.SplitSpendingLimit(ctx, testOrganizationOwnerID, nil, 100)
	require.ErrorIs(t, err, ErrOrganizationSpendingSplitTargets)

	members, err := fixture.service.SplitSpendingLimit(
		ctx,
		testOrganizationOwnerID,
		[]int64{testOrganizationOtherID, testOrganizationMemberID, testOrganizationMemberID},
		10,
	)
	require.NoError(t, err)
	require.Len(t, members, 2, "重复选中的成员只算一次")

	total := decimal.Zero
	for _, member := range members {
		require.NotNil(t, member.SpendingLimit)
		total = total.Add(decimal.NewFromFloat(*member.SpendingLimit))
	}
	require.True(t, total.Equal(decimal.NewFromInt(10)), "各人新上限之和必须精确等于总额")
	require.Len(t, fixture.members.writes, 1)
}

func TestSplitSpendingAmountConservesTotal(t *testing.T) {
	cases := []struct {
		total float64
		count int
	}{
		{total: 100, count: 3},
		{total: 0.1, count: 3},
		{total: 1, count: 7},
		{total: 0.00000002, count: 3},
		{total: 0, count: 4},
		{total: 12345.6789, count: 11},
		{total: 99.99999999, count: 6},
	}

	for _, testCase := range cases {
		shares, err := SplitSpendingAmount(testCase.total, testCase.count)
		require.NoError(t, err)
		require.Len(t, shares, testCase.count)

		sum := decimal.Zero
		minShare := decimal.NewFromFloat(shares[0])
		maxShare := minShare
		for _, share := range shares {
			value := decimal.NewFromFloat(share)
			sum = sum.Add(value)
			if value.LessThan(minShare) {
				minShare = value
			}
			if value.GreaterThan(maxShare) {
				maxShare = value
			}
		}
		require.True(
			t,
			sum.Equal(decimal.NewFromFloat(testCase.total)),
			"总额 %v 分给 %d 人后应精确守恒，实际为 %s", testCase.total, testCase.count, sum,
		)
		require.True(
			t,
			maxShare.Sub(minShare).LessThanOrEqual(decimal.New(1, -UsageBillingMonetaryScale)),
			"各份之间最多相差一个最小单位",
		)
	}
}

func TestSplitSpendingAmountRejectsInvalidInput(t *testing.T) {
	_, err := SplitSpendingAmount(100, 0)
	require.ErrorIs(t, err, ErrOrganizationSpendingSplitTargets)

	_, err = SplitSpendingAmount(-1, 3)
	require.ErrorIs(t, err, ErrOrganizationSpendingLimitInvalid)
}
