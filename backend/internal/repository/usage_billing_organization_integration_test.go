//go:build integration

package repository

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Wei-Shaw/sub2api/internal/service"
)

type organizationBillingFixture struct {
	owner    *service.User
	member   *service.User
	memberID int64
	apiKey   *service.APIKey
	account  *service.Account
}

// seedOrganizationBilling 建一个组织：管理员有余额，成员没有余额。
func seedOrganizationBilling(t *testing.T, ctx context.Context, ownerBalance float64) *organizationBillingFixture {
	t.Helper()

	client := testEntClient(t)
	suffix := time.Now().UnixNano()
	owner := mustCreateUser(t, client, &service.User{
		Email:        fmt.Sprintf("org-billing-owner-%d@example.com", suffix),
		PasswordHash: "hash",
		Balance:      ownerBalance,
	})
	member := mustCreateUser(t, client, &service.User{
		Email:        fmt.Sprintf("org-billing-member-%d@example.com", suffix),
		PasswordHash: "hash",
		Balance:      0,
	})

	organizationRepo := NewOrganizationRepository(client)
	organization := &service.Organization{Name: "Billing Team", OwnerUserID: owner.ID}
	require.NoError(t, organizationRepo.Create(ctx, organization))
	for _, userID := range []int64{owner.ID, member.ID} {
		require.NoError(t, organizationRepo.CreateMember(ctx, &service.OrganizationMembership{
			OrganizationID: organization.ID,
			UserID:         userID,
		}))
	}

	apiKey := mustCreateApiKey(t, client, &service.APIKey{
		UserID: member.ID,
		Key:    "sk-org-billing-" + uuid.NewString(),
		Name:   "org billing",
	})
	account := mustCreateAccount(t, client, &service.Account{
		Name: "org-billing-account-" + uuid.NewString(),
		Type: service.AccountTypeAPIKey,
	})

	return &organizationBillingFixture{
		owner:    owner,
		member:   member,
		memberID: member.ID,
		apiKey:   apiKey,
		account:  account,
	}
}

func readBalance(t *testing.T, ctx context.Context, userID int64) (balance, frozen float64) {
	t.Helper()
	require.NoError(t, integrationDB.QueryRowContext(ctx,
		"SELECT balance, COALESCE(frozen_balance, 0) FROM users WHERE id = $1", userID).Scan(&balance, &frozen))
	return balance, frozen
}

func readMemberSpending(t *testing.T, ctx context.Context, userID int64) (used, frozen float64) {
	t.Helper()
	require.NoError(t, integrationDB.QueryRowContext(ctx,
		"SELECT spending_used, spending_frozen FROM organization_members WHERE user_id = $1", userID).Scan(&used, &frozen))
	return used, frozen
}

func setMemberSpendingLimit(t *testing.T, ctx context.Context, userID int64, limit float64) {
	t.Helper()
	_, err := integrationDB.ExecContext(ctx,
		"UPDATE organization_members SET spending_limit = $1 WHERE user_id = $2", limit, userID)
	require.NoError(t, err)
}

func TestUsageBillingChargesOrganizationOwner(t *testing.T) {
	ctx := context.Background()
	fixture := seedOrganizationBilling(t, ctx, 100)
	repo := NewUsageBillingRepository(testEntClient(t), integrationDB)

	result, err := repo.Apply(ctx, &service.UsageBillingCommand{
		RequestID:   uuid.NewString(),
		APIKeyID:    fixture.apiKey.ID,
		UserID:      fixture.member.ID,
		AccountID:   fixture.account.ID,
		AccountType: service.AccountTypeAPIKey,
		BalanceCost: 2.5,
	})
	require.NoError(t, err)
	require.True(t, result.Applied)
	require.Equal(t, fixture.owner.ID, result.PayerUserID, "成员消费扣的是组织管理员的余额")
	require.Equal(t, fixture.member.ID, result.SpendingUserID)

	ownerBalance, _ := readBalance(t, ctx, fixture.owner.ID)
	require.InDelta(t, 97.5, ownerBalance, 0.000001)
	memberBalance, _ := readBalance(t, ctx, fixture.member.ID)
	require.InDelta(t, 0, memberBalance, 0.000001, "成员自己的余额一分没动")

	used, frozen := readMemberSpending(t, ctx, fixture.member.ID)
	require.InDelta(t, 2.5, used, 0.000001, "同一笔金额累计到成员已消费")
	require.InDelta(t, 0, frozen, 0.000001)
}

func TestUsageBillingChargesOwnerToThemselves(t *testing.T) {
	ctx := context.Background()
	fixture := seedOrganizationBilling(t, ctx, 100)
	client := testEntClient(t)
	ownerKey := mustCreateApiKey(t, client, &service.APIKey{
		UserID: fixture.owner.ID,
		Key:    "sk-org-owner-" + uuid.NewString(),
		Name:   "owner key",
	})
	repo := NewUsageBillingRepository(client, integrationDB)

	result, err := repo.Apply(ctx, &service.UsageBillingCommand{
		RequestID:   uuid.NewString(),
		APIKeyID:    ownerKey.ID,
		UserID:      fixture.owner.ID,
		AccountID:   fixture.account.ID,
		AccountType: service.AccountTypeAPIKey,
		BalanceCost: 1,
	})
	require.NoError(t, err)
	require.Equal(t, fixture.owner.ID, result.PayerUserID)
	require.Zero(t, result.SpendingUserID, "组织管理员自己的调用不占成员额度")

	used, _ := readMemberSpending(t, ctx, fixture.owner.ID)
	require.InDelta(t, 0, used, 0.000001)
}

func TestBatchImageHoldFreezesOwnerBalanceAndMemberQuota(t *testing.T) {
	ctx := context.Background()
	fixture := seedOrganizationBilling(t, ctx, 100)
	repo := NewUsageBillingRepository(testEntClient(t), integrationDB)
	batchID := "batch-" + uuid.NewString()

	holdCmd := &service.BatchImageBalanceHoldCommand{
		RequestID:  service.BatchImageHoldRequestID(batchID),
		APIKeyID:   fixture.apiKey.ID,
		UserID:     fixture.member.ID,
		BatchID:    batchID,
		HoldAmount: 10,
	}
	_, err := repo.ReserveBatchImageBalance(ctx, holdCmd)
	require.NoError(t, err)

	ownerBalance, ownerFrozen := readBalance(t, ctx, fixture.owner.ID)
	require.InDelta(t, 90, ownerBalance, 0.000001)
	require.InDelta(t, 10, ownerFrozen, 0.000001)
	used, frozen := readMemberSpending(t, ctx, fixture.member.ID)
	require.InDelta(t, 0, used, 0.000001)
	require.InDelta(t, 10, frozen, 0.000001, "预扣同时占住成员的额度")

	_, err = repo.CaptureBatchImageBalance(ctx, &service.BatchImageBalanceHoldCommand{
		RequestID:    service.BatchImageCaptureRequestID(batchID),
		APIKeyID:     fixture.apiKey.ID,
		UserID:       fixture.member.ID,
		BatchID:      batchID,
		HoldAmount:   10,
		ActualAmount: 4,
	})
	require.NoError(t, err)

	ownerBalance, ownerFrozen = readBalance(t, ctx, fixture.owner.ID)
	require.InDelta(t, 96, ownerBalance, 0.000001, "多冻的钱退回管理员余额")
	require.InDelta(t, 0, ownerFrozen, 0.000001)
	used, frozen = readMemberSpending(t, ctx, fixture.member.ID)
	require.InDelta(t, 4, used, 0.000001, "按真实花费累计成员已消费")
	require.InDelta(t, 0, frozen, 0.000001)
}

func TestBatchImageHoldReleasesMemberQuota(t *testing.T) {
	ctx := context.Background()
	fixture := seedOrganizationBilling(t, ctx, 100)
	repo := NewUsageBillingRepository(testEntClient(t), integrationDB)
	batchID := "batch-" + uuid.NewString()

	_, err := repo.ReserveBatchImageBalance(ctx, &service.BatchImageBalanceHoldCommand{
		RequestID:  service.BatchImageHoldRequestID(batchID),
		APIKeyID:   fixture.apiKey.ID,
		UserID:     fixture.member.ID,
		BatchID:    batchID,
		HoldAmount: 8,
	})
	require.NoError(t, err)

	_, err = repo.ReleaseBatchImageBalance(ctx, &service.BatchImageBalanceHoldCommand{
		RequestID:  service.BatchImageReleaseRequestID(batchID),
		APIKeyID:   fixture.apiKey.ID,
		UserID:     fixture.member.ID,
		BatchID:    batchID,
		HoldAmount: 8,
	})
	require.NoError(t, err)

	ownerBalance, ownerFrozen := readBalance(t, ctx, fixture.owner.ID)
	require.InDelta(t, 100, ownerBalance, 0.000001, "取消后钱全额回到管理员余额")
	require.InDelta(t, 0, ownerFrozen, 0.000001)
	used, frozen := readMemberSpending(t, ctx, fixture.member.ID)
	require.InDelta(t, 0, used, 0.000001)
	require.InDelta(t, 0, frozen, 0.000001)
}

func TestBatchImageHoldRejectsMemberOverLimit(t *testing.T) {
	ctx := context.Background()
	fixture := seedOrganizationBilling(t, ctx, 100)
	setMemberSpendingLimit(t, ctx, fixture.member.ID, 5)
	repo := NewUsageBillingRepository(testEntClient(t), integrationDB)
	batchID := "batch-" + uuid.NewString()

	_, err := repo.ReserveBatchImageBalance(ctx, &service.BatchImageBalanceHoldCommand{
		RequestID:  service.BatchImageHoldRequestID(batchID),
		APIKeyID:   fixture.apiKey.ID,
		UserID:     fixture.member.ID,
		BatchID:    batchID,
		HoldAmount: 10,
	})
	require.True(t, errors.Is(err, service.ErrOrganizationSpendingLimitExhausted),
		"预扣金额超过成员上限时直接拒绝")

	ownerBalance, ownerFrozen := readBalance(t, ctx, fixture.owner.ID)
	require.InDelta(t, 100, ownerBalance, 0.000001, "被拒绝的预扣不能动钱")
	require.InDelta(t, 0, ownerFrozen, 0.000001)
	_, frozen := readMemberSpending(t, ctx, fixture.member.ID)
	require.InDelta(t, 0, frozen, 0.000001)
}
