package service

import (
	"context"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"

	"github.com/stretchr/testify/require"
)

type organizationSpendingRepoStub struct {
	spending map[int64]float64
	err      error
}

func (r *organizationSpendingRepoStub) GetMemberSpending(_ context.Context, userID int64) (float64, error) {
	if r.err != nil {
		return 0, r.err
	}
	return r.spending[userID], nil
}

type billingUserRepoStub struct {
	UserRepository
	users map[int64]*User
}

func (r *billingUserRepoStub) GetByID(_ context.Context, id int64) (*User, error) {
	user, ok := r.users[id]
	if !ok {
		return nil, ErrUserNotFound
	}
	copyValue := *user
	return &copyValue, nil
}

const (
	testBillingOwnerID  = int64(1)
	testBillingMemberID = int64(2)
)

func newOrganizationBillingService(ownerBalance float64, spending map[int64]float64) *BillingCacheService {
	return &BillingCacheService{
		cfg: &config.Config{},
		userRepo: &billingUserRepoStub{users: map[int64]*User{
			testBillingOwnerID:  {ID: testBillingOwnerID, Balance: ownerBalance},
			testBillingMemberID: {ID: testBillingMemberID, Balance: 0},
		}},
		organizationSpendingRepo: &organizationSpendingRepoStub{spending: spending},
	}
}

func newOrganizationMemberUser(limit *float64) *User {
	organizationID := int64(5)
	return &User{
		ID:                        testBillingMemberID,
		OrganizationID:            &organizationID,
		OrganizationPayerUserID:   testBillingOwnerID,
		OrganizationSpendingLimit: limit,
	}
}

func TestBillingPayerUserID(t *testing.T) {
	require.Zero(t, BillingPayerUserID(nil))

	personal := &User{ID: 9}
	require.Equal(t, int64(9), BillingPayerUserID(personal), "个人用户自己付自己的")

	organizationID := int64(5)
	owner := &User{ID: testBillingOwnerID, OrganizationID: &organizationID}
	require.Equal(t, testBillingOwnerID, BillingPayerUserID(owner), "组织管理员本人也是自己付")

	require.Equal(t, testBillingOwnerID, BillingPayerUserID(newOrganizationMemberUser(nil)),
		"普通成员付的是组织付款账号的钱")
}

// 成员消费扣组织管理员余额：管理员没钱时，成员看到的是组织口径的提示，看不到金额。
func TestCheckBillingEligibilityUsesOrganizationPayerBalance(t *testing.T) {
	ctx := context.Background()

	rich := newOrganizationBillingService(100, nil)
	require.NoError(t, rich.CheckBillingEligibility(ctx, newOrganizationMemberUser(nil), nil, nil, nil, ""))

	broke := newOrganizationBillingService(0, nil)
	err := broke.CheckBillingEligibility(ctx, newOrganizationMemberUser(nil), nil, nil, nil, "")
	require.ErrorIs(t, err, ErrOrganizationBalanceInsufficient)
	require.NotErrorIs(t, err, ErrInsufficientBalance)
}

func TestCheckOrganizationSpendingEligibility(t *testing.T) {
	ctx := context.Background()

	unlimited := newOrganizationBillingService(100, map[int64]float64{testBillingMemberID: 999})
	require.NoError(t, unlimited.checkOrganizationSpendingEligibility(ctx, newOrganizationMemberUser(nil)),
		"不限额的成员不受已消费金额影响")

	blocked := newOrganizationBillingService(100, nil)
	require.ErrorIs(t,
		blocked.checkOrganizationSpendingEligibility(ctx, newOrganizationMemberUser(spendingLimitPtr(0))),
		ErrOrganizationSpendingLimitExhausted,
		"上限为 0 表示完全不能消费")

	remaining := newOrganizationBillingService(100, map[int64]float64{testBillingMemberID: 30})
	require.NoError(t,
		remaining.checkOrganizationSpendingEligibility(ctx, newOrganizationMemberUser(spendingLimitPtr(50))))

	exhausted := newOrganizationBillingService(100, map[int64]float64{testBillingMemberID: 50})
	require.ErrorIs(t,
		exhausted.checkOrganizationSpendingEligibility(ctx, newOrganizationMemberUser(spendingLimitPtr(50))),
		ErrOrganizationSpendingLimitExhausted)

	// 已冻结的金额同样占额度：已消费 40 加冻结 15 已经超过上限 50。
	frozen := newOrganizationBillingService(100, map[int64]float64{testBillingMemberID: 55})
	require.ErrorIs(t,
		frozen.checkOrganizationSpendingEligibility(ctx, newOrganizationMemberUser(spendingLimitPtr(50))),
		ErrOrganizationSpendingLimitExhausted)

	personal := newOrganizationBillingService(100, nil)
	require.NoError(t, personal.checkOrganizationSpendingEligibility(ctx, &User{ID: 9}),
		"个人用户不进入组织额度判断")
}

func TestCheckBillingEligibilityRejectsExhaustedMember(t *testing.T) {
	ctx := context.Background()
	service := newOrganizationBillingService(100, map[int64]float64{testBillingMemberID: 50})

	err := service.CheckBillingEligibility(ctx, newOrganizationMemberUser(spendingLimitPtr(50)), nil, nil, nil, "")
	require.ErrorIs(t, err, ErrOrganizationSpendingLimitExhausted)
}

func TestTranslateOrganizationBalanceError(t *testing.T) {
	require.NoError(t, translateOrganizationBalanceError(nil, 1, 2))
	require.ErrorIs(t,
		translateOrganizationBalanceError(ErrInsufficientBalance, testBillingOwnerID, testBillingMemberID),
		ErrOrganizationBalanceInsufficient)
	require.ErrorIs(t,
		translateOrganizationBalanceError(ErrInsufficientBalance, 9, 9),
		ErrInsufficientBalance,
		"自己付自己的时候保持原有提示")
}
