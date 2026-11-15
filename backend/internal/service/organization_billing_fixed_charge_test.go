//go:build unit

package service

import (
	"context"
	"errors"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

type fixedChargeOrganizationSpendingRepo struct {
	used   float64
	frozen float64
	err    error
	calls  atomic.Int64
}

func (r *fixedChargeOrganizationSpendingRepo) GetMemberSpending(context.Context, int64) (float64, *time.Time, error) {
	r.calls.Add(1)
	if r.err != nil {
		return 0, nil, r.err
	}
	return r.used + r.frozen, nil, nil
}

func newOrganizationFixedChargeRegressionService(
	t *testing.T,
	cache BillingCache,
	subRepo UserSubscriptionRepository,
	spendingRepo OrganizationSpendingRepository,
	inflightEnabled bool,
) *BillingCacheService {
	t.Helper()
	cfg := &config.Config{}
	cfg.Billing.InflightReservation.Enabled = inflightEnabled
	users := &billingUserRepoStub{users: map[int64]*User{
		testBillingOwnerID:  {ID: testBillingOwnerID, Balance: 100},
		testBillingMemberID: {ID: testBillingMemberID},
	}}
	svc := NewBillingCacheService(cache, users, subRepo, nil, nil, nil, cfg, nil)
	svc.SetOrganizationSpendingRepo(spendingRepo)
	t.Cleanup(svc.Stop)
	return svc
}

func TestReserveFixedChargeEnforcesOrganizationMemberRemainingSpending(t *testing.T) {
	limit := 10.0
	repo := &fixedChargeOrganizationSpendingRepo{used: 6, frozen: 2}
	svc := newOrganizationFixedChargeRegressionService(t, nil, nil, repo, false)
	member := newOrganizationMemberUser(&limit)

	reservation, err := svc.ReserveFixedCharge(context.Background(), member, nil, nil, nil, 2)
	require.NoError(t, err, "an exact charge equal to the used-plus-frozen remaining allowance is allowed")
	require.Nil(t, reservation)

	_, err = svc.ReserveFixedCharge(context.Background(), member, nil, nil, nil, 2.01)
	require.ErrorIs(t, err, ErrOrganizationSpendingLimitExhausted)
	require.EqualValues(t, 2, repo.calls.Load())
}

func TestReserveFixedChargeOrganizationPendingScopePreventsOverspendAndReleasesReservations(t *testing.T) {
	const apiKeyID int64 = 88
	limit := 10.0
	member := newOrganizationMemberUser(&limit)
	apiKey := &APIKey{ID: apiKeyID, Quota: 100}
	cache := &fixedChargeCacheStub{balance: 100}
	svc := newOrganizationFixedChargeRegressionService(t, cache, nil, nil, true)

	first, err := svc.ReserveFixedCharge(context.Background(), member, apiKey, nil, nil, 6)
	require.NoError(t, err)
	require.NotNil(t, first)

	second, err := svc.ReserveFixedCharge(context.Background(), member, apiKey, nil, nil, 6)
	require.Nil(t, second)
	require.ErrorIs(t, err, ErrOrganizationSpendingLimitExhausted)

	ownerScope := "user:" + strconv.FormatInt(testBillingOwnerID, 10)
	keyScope := inflightAPIKeyScope(apiKeyID)
	memberScope := inflightOrganizationMemberScope(member.ID)
	require.Len(t, cache.reserved[ownerScope], 1, "rejected charge must release only its owner reservation")
	require.Len(t, cache.reserved[keyScope], 1, "rejected charge must release its API key reservation")
	require.Len(t, cache.reserved[memberScope], 1, "rejected charge must release its member allowance reservation")

	first.Release()
	require.Empty(t, cache.reserved[ownerScope])
	require.Empty(t, cache.reserved[keyScope])
	require.Empty(t, cache.reserved[memberScope])
}

func TestReserveFixedChargeSpendingLoadFailureReturnsBillingUnavailable(t *testing.T) {
	limit := 10.0
	repo := &fixedChargeOrganizationSpendingRepo{err: errors.New("spending read failed")}
	svc := newOrganizationFixedChargeRegressionService(t, nil, nil, repo, false)

	_, err := svc.ReserveFixedCharge(context.Background(), newOrganizationMemberUser(&limit), nil, nil, nil, 1)
	require.ErrorIs(t, err, ErrBillingServiceUnavailable)
	require.EqualValues(t, 1, repo.calls.Load())
}

func TestReserveFixedChargePreservesUnlimitedPersonalAndSubscriptionBehavior(t *testing.T) {
	limit := 10.0
	repo := &fixedChargeOrganizationSpendingRepo{err: errors.New("member spending must not be loaded")}
	subscription := &UserSubscription{
		ID:        900,
		UserID:    testBillingMemberID,
		GroupID:   901,
		Status:    SubscriptionStatusActive,
		ExpiresAt: time.Now().Add(time.Hour),
	}
	subRepo := &fixedChargeSubscriptionRepoStub{sub: subscription}
	svc := newOrganizationFixedChargeRegressionService(t, nil, subRepo, repo, false)

	t.Run("unlimited organization member", func(t *testing.T) {
		_, err := svc.ReserveFixedCharge(context.Background(), newOrganizationMemberUser(nil), nil, nil, nil, 1)
		require.NoError(t, err)
	})

	t.Run("personal user", func(t *testing.T) {
		personal := &User{ID: testBillingOwnerID, OrganizationSpendingLimit: &limit}
		_, err := svc.ReserveFixedCharge(context.Background(), personal, nil, nil, nil, 1)
		require.NoError(t, err)
	})

	t.Run("subscription billing", func(t *testing.T) {
		group := &Group{ID: subscription.GroupID, SubscriptionType: SubscriptionTypeSubscription}
		member := newOrganizationMemberUser(&limit)
		_, err := svc.ReserveFixedCharge(context.Background(), member, nil, group, subscription, 1)
		require.NoError(t, err)
	})

	require.Zero(t, repo.calls.Load(), "these billing paths must not load organization member spending")
}
