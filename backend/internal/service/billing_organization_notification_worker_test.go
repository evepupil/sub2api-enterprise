//go:build unit

package service

import (
	"context"
	"net/mail"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func floatPointer(value float64) *float64 {
	return &value
}

type blockingPayerNotificationUserRepo struct {
	UserRepository
	users   map[int64]*User
	started chan int64
	release <-chan struct{}
}

func (r *blockingPayerNotificationUserRepo) GetByID(ctx context.Context, userID int64) (*User, error) {
	select {
	case r.started <- userID:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	select {
	case <-r.release:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	user, ok := r.users[userID]
	if !ok {
		return nil, ErrUserNotFound
	}
	copy := *user
	return &copy, nil
}

type organizationPayerNotificationHarness struct {
	service *BalanceNotifyService
	users   *blockingPayerNotificationUserRepo
	smtp    *notificationEmailTestSMTPServer
	release func()
}

func newOrganizationPayerNotificationHarness(t *testing.T, users map[int64]*User) *organizationPayerNotificationHarness {
	t.Helper()
	smtp := startNotificationEmailTestSMTPServer(t)
	settings := newNotificationEmailMemorySettingRepo()
	values := smtp.settings()
	values[SettingKeyBalanceLowNotifyEnabled] = "true"
	values[SettingKeyBalanceLowNotifyThreshold] = "10"
	require.NoError(t, settings.SetMultiple(context.Background(), values))

	emailService := NewEmailService(settings, nil)
	notificationEmailService := NewNotificationEmailService(settings, emailService)
	balanceNotifyService := NewBalanceNotifyService(emailService, settings, nil)
	balanceNotifyService.SetNotificationEmailService(notificationEmailService)

	releaseCh := make(chan struct{})
	var releaseOnce sync.Once
	userRepo := &blockingPayerNotificationUserRepo{
		users:   users,
		started: make(chan int64, 4),
		release: releaseCh,
	}
	release := func() { releaseOnce.Do(func() { close(releaseCh) }) }
	t.Cleanup(func() {
		release()
		balanceNotifyService.Stop()
	})
	return &organizationPayerNotificationHarness{
		service: balanceNotifyService,
		users:   userRepo,
		smtp:    smtp,
		release: release,
	}
}

func submitPayerNotificationWithoutWaitingForLookup(t *testing.T, harness *organizationPayerNotificationHarness, p *postUsageBillingParams, deps *billingDeps, result *UsageBillingApplyResult) {
	t.Helper()
	done := make(chan struct{})
	go func() {
		harness.service.submitUsageNotifications(p, deps, result)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		harness.release()
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			t.Fatal("notification enqueue did not return after releasing the payer lookup")
		}
		t.Fatal("notification enqueue waited for the payer lookup")
	}
}

func TestOrganizationBalanceNotificationUsesTransactionPayerAndDoesNotBlockEnqueue(t *testing.T) {
	const (
		memberID      int64 = 201
		snapshotPayer int64 = 202
		actualPayer   int64 = 203
		memberEmail         = "member-alert@example.test"
		snapshotEmail       = "snapshot-alert@example.test"
		actualEmail         = "actual-payer-alert@example.test"
	)
	member := &User{ID: memberID, OrganizationPayerUserID: snapshotPayer, BalanceNotifyEnabled: false}
	snapshotOwner := &User{ID: snapshotPayer, BalanceNotifyEnabled: true, BalanceNotifyExtraEmails: []NotifyEmailEntry{{Email: snapshotEmail, Verified: true}}}
	actualOwner := &User{ID: actualPayer, Username: "Actual owner", BalanceNotifyEnabled: true, BalanceNotifyExtraEmails: []NotifyEmailEntry{{Email: actualEmail, Verified: true}}}
	harness := newOrganizationPayerNotificationHarness(t, map[int64]*User{
		snapshotPayer: snapshotOwner,
		actualPayer:   actualOwner,
	})

	p := &postUsageBillingParams{User: member, Cost: &CostBreakdown{ActualCost: 1}}
	deps := &billingDeps{userRepo: harness.users, balanceNotifyService: harness.service}
	result := &UsageBillingApplyResult{PayerUserID: actualPayer, NewBalance: floatPointer(9)}
	submitPayerNotificationWithoutWaitingForLookup(t, harness, p, deps, result)

	select {
	case requestedID := <-harness.users.started:
		require.Equal(t, int64(actualPayer), requestedID, "the transaction result payer overrides the member snapshot payer")
	case <-time.After(2 * time.Second):
		t.Fatal("notification worker did not load the transaction payer")
	}
	harness.release()
	// Drain accepted work without canceling the SMTP delivery under test.
	harness.service.usageNotifications.pool.StopAndWait()

	require.EqualValues(t, 1, harness.smtp.messageCount())
	message := harness.smtp.lastMessage()
	parsed, err := mail.ReadMessage(strings.NewReader(message))
	require.NoError(t, err)
	recipients, err := parsed.Header.AddressList("To")
	require.NoError(t, err)
	require.Len(t, recipients, 1)
	require.Equal(t, actualEmail, recipients[0].Address, "email should go to the transaction payer's configured recipient")
}

func TestOrganizationBalanceNotificationUsesPayerToggleToSuppressDelivery(t *testing.T) {
	const (
		memberID      int64 = 211
		snapshotPayer int64 = 212
		actualPayer   int64 = 213
	)
	member := &User{ID: memberID, OrganizationPayerUserID: snapshotPayer, BalanceNotifyEnabled: false}
	owner := &User{ID: actualPayer, BalanceNotifyEnabled: false, BalanceNotifyExtraEmails: []NotifyEmailEntry{{Email: "disabled-owner@example.test", Verified: true}}}
	harness := newOrganizationPayerNotificationHarness(t, map[int64]*User{actualPayer: owner})

	p := &postUsageBillingParams{User: member, Cost: &CostBreakdown{ActualCost: 1}}
	deps := &billingDeps{userRepo: harness.users, balanceNotifyService: harness.service}
	result := &UsageBillingApplyResult{PayerUserID: actualPayer, NewBalance: floatPointer(9)}
	submitPayerNotificationWithoutWaitingForLookup(t, harness, p, deps, result)

	select {
	case requestedID := <-harness.users.started:
		require.Equal(t, int64(actualPayer), requestedID)
	case <-time.After(2 * time.Second):
		t.Fatal("notification worker did not load the payer whose setting controls delivery")
	}
	harness.release()
	harness.service.usageNotifications.pool.StopAndWait()

	require.Zero(t, harness.smtp.messageCount(), "a disabled payer must suppress delivery even when a member request triggered work")
}

func TestPersonalDisabledBalanceNotificationRemainsSkipped(t *testing.T) {
	const personalID int64 = 221
	personal := &User{ID: personalID, BalanceNotifyEnabled: false}
	harness := newOrganizationPayerNotificationHarness(t, map[int64]*User{personalID: personal})

	p := &postUsageBillingParams{User: personal, Cost: &CostBreakdown{ActualCost: 1}}
	deps := &billingDeps{userRepo: harness.users, balanceNotifyService: harness.service}
	result := &UsageBillingApplyResult{PayerUserID: personalID, NewBalance: floatPointer(9)}
	harness.service.submitUsageNotifications(p, deps, result)
	harness.release()
	harness.service.usageNotifications.pool.StopAndWait()

	select {
	case requestedID := <-harness.users.started:
		t.Fatalf("personal disabled notification unexpectedly loaded user %d", requestedID)
	default:
	}
	require.Zero(t, harness.smtp.messageCount())
}
