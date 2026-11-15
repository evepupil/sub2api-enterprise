//go:build integration

package repository

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

func TestUsageBillingDeletedOrganizationAPIKeyBillsAndReplaysIdempotently(t *testing.T) {
	modes := []struct {
		name          string
		quotaCost     float64
		rateLimitCost float64
		quotaUsed     float64
		quota         float64
	}{
		{name: "quota counters", quotaCost: 0.5, quotaUsed: 9.75, quota: 10},
		{name: "monetary window counters", rateLimitCost: 0.5, quotaUsed: 4.25, quota: 100},
		{name: "quota and monetary windows", quotaCost: 0.5, rateLimitCost: 0.5, quotaUsed: 9.75, quota: 10},
	}

	for _, mode := range modes {
		t.Run(mode.name, func(t *testing.T) {
			ctx := context.Background()
			fixture := seedOrganizationBilling(t, ctx, 50)
			client := testEntClient(t)
			repo := NewUsageBillingRepository(client, integrationDB)
			windowStart := time.Now().Add(-time.Minute)
			_, err := integrationDB.ExecContext(ctx, `
				UPDATE api_keys SET
					quota = $1,
					quota_used = $2,
					rate_limit_5h = 100,
					usage_5h = 7.5,
					window_5h_start = $3,
					rate_limit_1d = 100,
					usage_1d = 11.5,
					window_1d_start = $3,
					rate_limit_7d = 100,
					usage_7d = 15.5,
					window_7d_start = $3,
					status = $4
				WHERE id = $5 AND deleted_at IS NULL`,
				mode.quota, mode.quotaUsed, windowStart, service.StatusAPIKeyActive, fixture.apiKey.ID)
			require.NoError(t, err)

			keyRepo := NewAPIKeyRepository(client, integrationDB)
			require.NoError(t, keyRepo.Delete(ctx, fixture.apiKey.ID))

			requestID := uuid.NewString()
			cmd := &service.UsageBillingCommand{
				RequestID:           requestID,
				APIKeyID:            fixture.apiKey.ID,
				UserID:              fixture.member.ID,
				AccountID:           fixture.account.ID,
				AccountType:         service.AccountTypeAPIKey,
				BalanceCost:         1.25,
				APIKeyQuotaCost:     mode.quotaCost,
				APIKeyRateLimitCost: mode.rateLimitCost,
			}
			first, err := repo.Apply(ctx, cmd)
			require.NoError(t, err)
			require.NotNil(t, first)
			require.True(t, first.Applied)
			require.Equal(t, fixture.owner.ID, first.PayerUserID)
			require.Equal(t, fixture.member.ID, first.SpendingUserID)

			replay, err := repo.Apply(ctx, cmd)
			require.NoError(t, err)
			require.NotNil(t, replay)
			require.False(t, replay.Applied, "the same billing request must be deduplicated")

			ownerBalance, _ := readBalance(t, ctx, fixture.owner.ID)
			require.InDelta(t, 48.75, ownerBalance, 0.000001)
			memberBalance, _ := readBalance(t, ctx, fixture.member.ID)
			require.InDelta(t, 0, memberBalance, 0.000001)
			used, frozen := readMemberSpending(t, ctx, fixture.member.ID)
			require.InDelta(t, 1.25, used, 0.000001)
			require.InDelta(t, 0, frozen, 0.000001)

			var deletedAt sql.NullTime
			var status string
			var quotaUsed, usage5h, usage1d, usage7d float64
			err = integrationDB.QueryRowContext(ctx, `
				SELECT deleted_at, status, quota_used, usage_5h, usage_1d, usage_7d
				FROM api_keys WHERE id = $1`, fixture.apiKey.ID).
				Scan(&deletedAt, &status, &quotaUsed, &usage5h, &usage1d, &usage7d)
			require.NoError(t, err)
			require.True(t, deletedAt.Valid, "billing a deleted key must not reactivate it")
			require.Equal(t, service.StatusAPIKeyActive, status)
			require.InDelta(t, mode.quotaUsed, quotaUsed, 0.000001)
			require.InDelta(t, 7.5, usage5h, 0.000001)
			require.InDelta(t, 11.5, usage1d, 0.000001)
			require.InDelta(t, 15.5, usage7d, 0.000001)

			var dedupCount int
			err = integrationDB.QueryRowContext(ctx,
				"SELECT COUNT(*) FROM usage_billing_dedup WHERE request_id = $1 AND api_key_id = $2",
				requestID, fixture.apiKey.ID).Scan(&dedupCount)
			require.NoError(t, err)
			require.Equal(t, 1, dedupCount)
		})
	}
}

func TestUsageBillingDeletedAPIKeyStillConsumesSubscriptionOnce(t *testing.T) {
	ctx := context.Background()
	client := testEntClient(t)
	user := mustCreateUser(t, client, &service.User{
		Email: "deleted-sub-" + uuid.NewString() + "@example.com", PasswordHash: "hash", Balance: 100,
	})
	group := mustCreateGroup(t, client, &service.Group{
		Name: "deleted-sub-" + uuid.NewString(), Platform: service.PlatformOpenAI,
		SubscriptionType: service.SubscriptionTypeSubscription,
	})
	subscription := mustCreateSubscription(t, client, &service.UserSubscription{UserID: user.ID, GroupID: group.ID})
	key := mustCreateApiKey(t, client, &service.APIKey{
		UserID: user.ID, GroupID: &group.ID, Key: "sk-deleted-sub-" + uuid.NewString(),
		Name: "deleted subscription key", Quota: 10, RateLimit5h: 10,
	})
	require.NoError(t, NewAPIKeyRepository(client, integrationDB).Delete(ctx, key.ID))
	repo := NewUsageBillingRepository(client, integrationDB)
	cmd := &service.UsageBillingCommand{
		RequestID: uuid.NewString(), APIKeyID: key.ID, UserID: user.ID,
		SubscriptionID: &subscription.ID, SubscriptionCost: 1.25,
		APIKeyQuotaCost: 1.25, APIKeyRateLimitCost: 1.25,
	}
	first, err := repo.Apply(ctx, cmd)
	require.NoError(t, err)
	require.True(t, first.Applied)
	replay, err := repo.Apply(ctx, cmd)
	require.NoError(t, err)
	require.False(t, replay.Applied)

	var daily, weekly, monthly float64
	require.NoError(t, integrationDB.QueryRowContext(ctx,
		"SELECT daily_usage_usd, weekly_usage_usd, monthly_usage_usd FROM user_subscriptions WHERE id = $1",
		subscription.ID).Scan(&daily, &weekly, &monthly))
	for _, consumed := range []float64{daily, weekly, monthly} {
		require.InDelta(t, 1.25, consumed, 0.000001)
	}
	balance, _ := readBalance(t, ctx, user.ID)
	require.InDelta(t, 100, balance, 0.000001, "subscription usage must not debit the balance")
	var quotaUsed, windowUsed float64
	var deleted bool
	require.NoError(t, integrationDB.QueryRowContext(ctx,
		"SELECT quota_used, usage_5h, deleted_at IS NOT NULL FROM api_keys WHERE id = $1", key.ID).
		Scan(&quotaUsed, &windowUsed, &deleted))
	require.True(t, deleted)
	require.Zero(t, quotaUsed)
	require.Zero(t, windowUsed)
	var dedupCount int
	require.NoError(t, integrationDB.QueryRowContext(ctx,
		"SELECT count(*) FROM usage_billing_dedup WHERE request_id = $1 AND api_key_id = $2",
		cmd.RequestID, key.ID).Scan(&dedupCount))
	require.Equal(t, 1, dedupCount)
}
