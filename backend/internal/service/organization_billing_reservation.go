package service

import (
	"context"
	"strconv"

	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
)

func inflightOrganizationMemberScope(userID int64) string {
	return "organization-member:" + strconv.FormatInt(userID, 10)
}

func (s *BillingCacheService) checkFixedChargeOrganizationSpending(ctx context.Context, user *User, pending float64) error {
	if user == nil || user.OrganizationPayerUserID <= 0 || user.OrganizationSpendingLimit == nil {
		return nil
	}
	limit := *user.OrganizationSpendingLimit
	if limit <= 0 {
		return ErrOrganizationSpendingLimitExhausted
	}

	spending, err := s.GetOrganizationMemberSpending(ctx, user.ID)
	if err != nil {
		if s.circuitBreaker != nil {
			s.circuitBreaker.OnFailure(err)
		}
		logger.LegacyPrintf("service.billing_cache",
			"ALERT: organization member spending check failed for fixed charge user %d: %v", user.ID, err)
		return ErrBillingServiceUnavailable.WithCause(err)
	}
	if s.circuitBreaker != nil {
		s.circuitBreaker.OnSuccess()
	}
	if spending+pending > limit {
		return ErrOrganizationSpendingLimitExhausted
	}
	return nil
}
