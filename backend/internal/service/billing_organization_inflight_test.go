//go:build unit

package service

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
)

type organizationPayerInflightCache struct {
	*memInflightCache
	mu sync.Mutex

	balances          map[int64]float64
	reservations      map[int64]*memInflightCache
	subscriptionCache *SubscriptionCacheData
	balanceReadIDs    []int64
	reserveIDs        []int64
	renewIDs          []int64
	releaseIDs        []int64
	deductionIDs      []int64
	deductions        map[int64]float64
	spendingIDs       []int64
}

func newOrganizationPayerInflightCache(balances map[int64]float64) *organizationPayerInflightCache {
	return &organizationPayerInflightCache{
		memInflightCache: newMemInflightCache(0),
		balances:         balances,
		reservations:     make(map[int64]*memInflightCache),
		deductions:       make(map[int64]float64),
	}
}

func (c *organizationPayerInflightCache) GetUserBalance(_ context.Context, userID int64) (float64, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.balanceReadIDs = append(c.balanceReadIDs, userID)
	return c.balances[userID], nil
}

func (c *organizationPayerInflightCache) reservationCache(userID int64) *memInflightCache {
	c.mu.Lock()
	defer c.mu.Unlock()
	cache := c.reservations[userID]
	if cache == nil {
		cache = newMemInflightCache(c.balances[userID])
		c.reservations[userID] = cache
	}
	return cache
}

func (c *organizationPayerInflightCache) ReserveInflightBalance(ctx context.Context, userID int64, requestID string, amount, balance float64, ttl time.Duration) (bool, float64, error) {
	c.mu.Lock()
	c.reserveIDs = append(c.reserveIDs, userID)
	c.mu.Unlock()
	return c.reservationCache(userID).ReserveInflightBalance(ctx, userID, requestID, amount, balance, ttl)
}

func (c *organizationPayerInflightCache) RenewInflightBalance(ctx context.Context, userID int64, requestID string, ttl time.Duration) (bool, error) {
	c.mu.Lock()
	c.renewIDs = append(c.renewIDs, userID)
	c.mu.Unlock()
	return c.reservationCache(userID).RenewInflightBalance(ctx, userID, requestID, ttl)
}

func (c *organizationPayerInflightCache) ReleaseInflightBalance(ctx context.Context, userID int64, requestID string) error {
	c.mu.Lock()
	c.releaseIDs = append(c.releaseIDs, userID)
	c.mu.Unlock()
	return c.reservationCache(userID).ReleaseInflightBalance(ctx, userID, requestID)
}

func (c *organizationPayerInflightCache) DeductUserBalance(_ context.Context, userID int64, amount float64) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.deductionIDs = append(c.deductionIDs, userID)
	c.deductions[userID] += amount
	c.balances[userID] -= amount
	return nil
}

func (c *organizationPayerInflightCache) IncrOrganizationMemberSpending(_ context.Context, userID int64, _ float64) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.spendingIDs = append(c.spendingIDs, userID)
	return nil
}

func (c *organizationPayerInflightCache) GetSubscriptionCache(context.Context, int64, int64) (*SubscriptionCacheData, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.subscriptionCache == nil {
		return nil, nil
	}
	data := *c.subscriptionCache
	return &data, nil
}

func (c *organizationPayerInflightCache) ids(values []int64) []int64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]int64(nil), values...)
}

func newOrganizationPayerBillingService(t *testing.T, cache *organizationPayerInflightCache, enabled bool) *BillingCacheService {
	t.Helper()
	cfg := &config.Config{}
	cfg.Billing.InflightReservation.Enabled = enabled
	cfg.Billing.InflightReservation.TTLSeconds = 2
	svc := NewBillingCacheService(cache, nil, nil, nil, nil, nil, cfg, nil)
	t.Cleanup(svc.Stop)
	return svc
}

func TestOrganizationInflightReservationsSharePayerBalance(t *testing.T) {
	const payerID, firstMemberID, secondMemberID int64 = 700, 701, 702
	cache := newOrganizationPayerInflightCache(map[int64]float64{
		payerID:        1,
		firstMemberID:  0,
		secondMemberID: 0,
	})
	svc := newOrganizationPayerBillingService(t, cache, true)
	ctx := context.Background()

	first, err := svc.ReserveInflight(ctx, &User{ID: firstMemberID, OrganizationPayerUserID: payerID}, nil, nil, 0.65)
	require.NoError(t, err)
	require.NotNil(t, first)
	t.Cleanup(first.Release)
	require.Eventually(t, func() bool { return len(cache.ids(cache.renewIDs)) > 0 }, 3*time.Second, 10*time.Millisecond)

	_, err = svc.ReserveInflightBalance(ctx, &User{ID: secondMemberID, OrganizationPayerUserID: payerID}, nil, nil, 0.4)
	require.ErrorIs(t, err, ErrOrganizationBalanceInsufficient)

	first.Release()
	require.Equal(t, []int64{payerID, payerID}, cache.ids(cache.balanceReadIDs))
	require.Equal(t, []int64{payerID, payerID}, cache.ids(cache.reserveIDs))
	require.NotEmpty(t, cache.ids(cache.renewIDs))
	require.Subset(t, cache.ids(cache.renewIDs), []int64{payerID})
	require.Equal(t, []int64{payerID}, cache.ids(cache.releaseIDs))
}

func TestOrganizationFixedChargeUsesPayerWithReservationsEnabledOrDisabled(t *testing.T) {
	const payerID, memberID int64 = 710, 711
	for _, enabled := range []bool{true, false} {
		t.Run(map[bool]string{true: "enabled", false: "disabled"}[enabled], func(t *testing.T) {
			cache := newOrganizationPayerInflightCache(map[int64]float64{payerID: 2, memberID: 0})
			svc := newOrganizationPayerBillingService(t, cache, enabled)
			reservation, err := svc.ReserveFixedCharge(context.Background(), &User{ID: memberID, OrganizationPayerUserID: payerID}, nil, nil, nil, 1)
			require.NoError(t, err)
			if enabled {
				require.NotNil(t, reservation)
				reservation.Release()
				require.Equal(t, []int64{payerID, payerID}, cache.ids(cache.balanceReadIDs))
				require.Equal(t, []int64{payerID}, cache.ids(cache.reserveIDs))
				require.Equal(t, []int64{payerID}, cache.ids(cache.releaseIDs))
			} else {
				require.Nil(t, reservation)
				require.Equal(t, []int64{payerID}, cache.ids(cache.balanceReadIDs))
				require.Empty(t, cache.ids(cache.reserveIDs))
			}
		})
	}

	t.Run("insufficient payer funds use organization error", func(t *testing.T) {
		cache := newOrganizationPayerInflightCache(map[int64]float64{payerID: 0.25, memberID: 100})
		svc := newOrganizationPayerBillingService(t, cache, false)
		_, err := svc.ReserveFixedCharge(context.Background(), &User{ID: memberID, OrganizationPayerUserID: payerID}, nil, nil, nil, 0.5)
		require.ErrorIs(t, err, ErrOrganizationBalanceInsufficient)
		require.Equal(t, []int64{payerID}, cache.ids(cache.balanceReadIDs))
	})
}

func TestOrganizationCacheDebitUsesTransactionPayerAndMemberSpendingIdentity(t *testing.T) {
	const memberID, snapshotPayerID, transactionPayerID int64 = 720, 721, 722
	cache := newOrganizationPayerInflightCache(map[int64]float64{snapshotPayerID: 20, transactionPayerID: 20})
	svc := newOrganizationPayerBillingService(t, cache, true)
	newBalance := 19.25
	syncBalanceCacheAfterDeduction(context.Background(), &postUsageBillingParams{
		Cost: &CostBreakdown{ActualCost: 0.75},
		User: &User{ID: memberID, OrganizationPayerUserID: snapshotPayerID},
	}, &billingDeps{billingCacheService: svc}, &UsageBillingApplyResult{
		Applied:        true,
		NewBalance:     &newBalance,
		PayerUserID:    transactionPayerID,
		SpendingUserID: memberID,
	})

	cache.mu.Lock()
	defer cache.mu.Unlock()
	require.Equal(t, []int64{transactionPayerID}, cache.deductionIDs)
	require.InDelta(t, 0.75, cache.deductions[transactionPayerID], 1e-12)
	require.Equal(t, []int64{memberID}, cache.spendingIDs)
}

func TestOrganizationBillingPreservesPersonalAndSubscriptionReservationPaths(t *testing.T) {
	const personalID, memberID, payerID int64 = 730, 731, 732

	t.Run("personal balance remains the reservation payer", func(t *testing.T) {
		cache := newOrganizationPayerInflightCache(map[int64]float64{personalID: 1, payerID: 10})
		svc := newOrganizationPayerBillingService(t, cache, true)
		reservation, err := svc.ReserveInflight(context.Background(), &User{ID: personalID}, nil, nil, 0.25)
		require.NoError(t, err)
		require.NotNil(t, reservation)
		reservation.Release()
		require.Equal(t, []int64{personalID}, cache.ids(cache.balanceReadIDs))
		require.Equal(t, []int64{personalID}, cache.ids(cache.reserveIDs))
		require.Equal(t, []int64{personalID}, cache.ids(cache.releaseIDs))
	})

	t.Run("subscription billing does not reserve balance", func(t *testing.T) {
		cache := newOrganizationPayerInflightCache(map[int64]float64{memberID: 0, payerID: 100})
		cache.subscriptionCache = &SubscriptionCacheData{Status: StatusActive, ExpiresAt: time.Now().Add(time.Hour)}
		svc := newOrganizationPayerBillingService(t, cache, true)
		group := &Group{ID: 9, SubscriptionType: SubscriptionTypeSubscription}
		subscription := &UserSubscription{ID: 10, UserID: memberID, GroupID: group.ID, Status: StatusActive, ExpiresAt: time.Now().Add(time.Hour)}
		reservation, err := svc.ReserveFixedCharge(context.Background(), &User{ID: memberID, OrganizationPayerUserID: payerID}, nil, group, subscription, 0.25)
		require.NoError(t, err)
		require.Nil(t, reservation)
		require.Empty(t, cache.ids(cache.balanceReadIDs))
		require.Empty(t, cache.ids(cache.reserveIDs))
	})
}

type organizationPayerNotificationUserRepo struct {
	UserRepository
	users map[int64]*User
}

func (r *organizationPayerNotificationUserRepo) GetByID(_ context.Context, id int64) (*User, error) {
	return r.users[id], nil
}

func TestOrganizationBalanceNotificationUsesPayerIdentity(t *testing.T) {
	const memberID, snapshotPayerID, transactionPayerID int64 = 740, 741, 742
	member := &User{ID: memberID, OrganizationPayerUserID: snapshotPayerID}
	transactionPayer := &User{ID: transactionPayerID, BalanceNotifyEnabled: true}
	deps := &billingDeps{userRepo: &organizationPayerNotificationUserRepo{users: map[int64]*User{
		snapshotPayerID:    {ID: snapshotPayerID},
		transactionPayerID: transactionPayer,
	}}}

	got := resolveBalanceNotifyUser(context.Background(), &postUsageBillingParams{User: member}, deps, &UsageBillingApplyResult{PayerUserID: transactionPayerID})
	require.Same(t, transactionPayer, got)
}
