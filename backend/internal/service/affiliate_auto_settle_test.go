package service

import (
	"context"
	"errors"
	"testing"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/stretchr/testify/require"
)

// autoSettleAffiliateRepoStub 只实现返利自动到账会用到的方法，其余方法走内嵌的空接口（被调用就 panic）
type autoSettleAffiliateRepoStub struct {
	AffiliateRepository
	summaries     map[int64]*AffiliateSummary
	accrued       []float64
	transferCalls []int64
	transferred   float64
	transferErr   error
}

func (r *autoSettleAffiliateRepoStub) EnsureUserAffiliate(_ context.Context, userID int64) (*AffiliateSummary, error) {
	if summary, ok := r.summaries[userID]; ok {
		cp := *summary
		return &cp, nil
	}
	return &AffiliateSummary{UserID: userID, AffCode: "AFFTEST", CreatedAt: time.Now().Add(-time.Hour)}, nil
}

func (r *autoSettleAffiliateRepoStub) AccrueQuota(_ context.Context, _, _ int64, amount float64, _ int, _ *int64) (bool, error) {
	r.accrued = append(r.accrued, amount)
	return true, nil
}

func (r *autoSettleAffiliateRepoStub) GetAccruedRebateFromInvitee(context.Context, int64, int64) (float64, error) {
	return 0, nil
}

func (r *autoSettleAffiliateRepoStub) ThawFrozenQuota(context.Context, int64) (float64, error) {
	return 0, nil
}

func (r *autoSettleAffiliateRepoStub) ListInvitees(context.Context, int64, int) ([]AffiliateInvitee, error) {
	return nil, nil
}

func (r *autoSettleAffiliateRepoStub) TransferQuotaToBalance(_ context.Context, userID int64) (float64, float64, error) {
	r.transferCalls = append(r.transferCalls, userID)
	if r.transferErr != nil {
		return 0, 0, r.transferErr
	}
	return r.transferred, 100, nil
}

// autoSettleSettingRepoStub 只给邀请返利的几个设置，其余方法走内嵌的空接口
type autoSettleSettingRepoStub struct {
	SettingRepository
	values map[string]string
}

func (s *autoSettleSettingRepoStub) GetValue(_ context.Context, key string) (string, error) {
	if value, ok := s.values[key]; ok {
		return value, nil
	}
	return "", ErrSettingNotFound
}

const (
	autoSettleInviterID = int64(7)
	autoSettleInviteeID = int64(41)
)

func newAutoSettleFixture(settings map[string]string) (*AffiliateService, *autoSettleAffiliateRepoStub) {
	inviterID := autoSettleInviterID
	repo := &autoSettleAffiliateRepoStub{
		summaries: map[int64]*AffiliateSummary{
			autoSettleInviteeID: {UserID: autoSettleInviteeID, AffCode: "INVITEE", InviterID: &inviterID, CreatedAt: time.Now().Add(-time.Hour)},
			autoSettleInviterID: {UserID: autoSettleInviterID, AffCode: "INVITER", CreatedAt: time.Now().Add(-48 * time.Hour)},
		},
		transferred: 5,
	}
	values := map[string]string{
		SettingKeyAffiliateEnabled:    "true",
		SettingKeyAffiliateRebateRate: "10",
	}
	for key, value := range settings {
		values[key] = value
	}
	settingSvc := NewSettingService(&autoSettleSettingRepoStub{values: values}, nil)
	return NewAffiliateService(repo, settingSvc, nil, nil), repo
}

func TestAccrueInviteRebate_CreditsInviterBalanceRightAway(t *testing.T) {
	svc, repo := newAutoSettleFixture(nil)

	rebate, err := svc.AccrueInviteRebate(context.Background(), autoSettleInviteeID, 50)

	require.NoError(t, err)
	require.InDelta(t, 5, rebate, 1e-9)
	require.Equal(t, []float64{5}, repo.accrued)
	// 兑换余额码、管理员加余额这两条路不在事务里：返利落库后马上转进邀请人余额
	require.Equal(t, []int64{autoSettleInviterID}, repo.transferCalls)
}

func TestAccrueInviteRebate_InsideCallerTransactionLeavesSettlementToCaller(t *testing.T) {
	svc, repo := newAutoSettleFixture(nil)
	ctx := dbent.NewTxContext(context.Background(), &dbent.Tx{})
	orderID := int64(88)

	rebate, err := svc.AccrueInviteRebateForOrder(ctx, autoSettleInviteeID, 50, &orderID)

	require.NoError(t, err)
	require.InDelta(t, 5, rebate, 1e-9)
	// 在线充值在事务里发返利：要等调用方提交后再转，这里不能先动余额
	require.Empty(t, repo.transferCalls)
}

func TestAccrueInviteRebate_TransferFailureDoesNotFailTheRebate(t *testing.T) {
	svc, repo := newAutoSettleFixture(nil)
	repo.transferErr = errors.New("db down")

	rebate, err := svc.AccrueInviteRebate(context.Background(), autoSettleInviteeID, 50)

	// 返利已经记上，转账失败交给每分钟的兜底再转
	require.NoError(t, err)
	require.InDelta(t, 5, rebate, 1e-9)
	require.Equal(t, []int64{autoSettleInviterID}, repo.transferCalls)
}

func TestSettleRebatesToBalance_NothingToTransferIsNotAnError(t *testing.T) {
	svc, repo := newAutoSettleFixture(nil)
	repo.transferErr = ErrAffiliateQuotaEmpty

	transferred, err := svc.SettleRebatesToBalance(context.Background(), autoSettleInviterID)
	require.NoError(t, err)
	require.Zero(t, transferred)

	repo.transferErr = errors.New("db down")
	_, err = svc.SettleRebatesToBalance(context.Background(), autoSettleInviterID)
	require.EqualError(t, err, "db down")
}

func TestSettleInviterOf_OnlyWhenTheUserHasAnInviter(t *testing.T) {
	svc, repo := newAutoSettleFixture(nil)

	svc.SettleInviterOf(context.Background(), autoSettleInviterID) // 邀请人自己没有上级
	require.Empty(t, repo.transferCalls)

	svc.SettleInviterOf(context.Background(), autoSettleInviteeID)
	require.Equal(t, []int64{autoSettleInviterID}, repo.transferCalls)
}

func TestGetAffiliateDetail_CarriesRebateRules(t *testing.T) {
	svc, _ := newAutoSettleFixture(map[string]string{
		SettingKeyAffiliateRebateFreezeHours:   "72",
		SettingKeyAffiliateRebateDurationDays:  "30",
		SettingKeyAffiliateRebatePerInviteeCap: "50",
	})

	detail, err := svc.GetAffiliateDetail(context.Background(), autoSettleInviterID)

	require.NoError(t, err)
	require.Equal(t, 72, detail.RebateFreezeHours)
	require.Equal(t, 30, detail.RebateDurationDays)
	require.InDelta(t, 50, detail.RebatePerInviteeCap, 1e-9)
	require.InDelta(t, 10, detail.EffectiveRebateRatePercent, 1e-9)
}

type pendingRebateListerStub struct {
	userIDs []int64
	err     error
	limit   int
}

func (l *pendingRebateListerStub) ListUsersWithPendingRebates(_ context.Context, limit int) ([]int64, error) {
	l.limit = limit
	return l.userIDs, l.err
}

type rebateSettlerStub struct {
	results map[int64]float64
	errs    map[int64]error
	calls   []int64
}

func (s *rebateSettlerStub) SettleRebatesToBalance(_ context.Context, userID int64) (float64, error) {
	s.calls = append(s.calls, userID)
	return s.results[userID], s.errs[userID]
}

func TestAffiliateRebateSettlementRunOnce_SettlesEveryPendingInviter(t *testing.T) {
	lister := &pendingRebateListerStub{userIDs: []int64{3, 5, 8}}
	settler := &rebateSettlerStub{
		results: map[int64]float64{3: 1.5, 8: 0},
		errs:    map[int64]error{5: errors.New("db down")},
	}
	svc := NewAffiliateRebateSettlementService(lister, settler, time.Minute)

	settled := svc.runOnce()

	// 某一个人失败不影响后面的人；真正有钱进余额的才算
	require.Equal(t, 1, settled)
	require.Equal(t, []int64{3, 5, 8}, settler.calls)
	require.Equal(t, affiliateSettleBatchSize, lister.limit)
}

func TestAffiliateRebateSettlementRunOnce_ListFailureSettlesNothing(t *testing.T) {
	settler := &rebateSettlerStub{}
	svc := NewAffiliateRebateSettlementService(&pendingRebateListerStub{err: errors.New("db down")}, settler, time.Minute)

	require.Zero(t, svc.runOnce())
	require.Empty(t, settler.calls)
}

func TestAffiliateRebateSettlementStart_WithoutListerDoesNothing(t *testing.T) {
	svc := NewAffiliateRebateSettlementService(nil, &rebateSettlerStub{}, time.Minute)
	svc.Start()
	svc.Stop()
}
