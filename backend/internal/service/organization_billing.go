package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
)

var (
	// ErrOrganizationSpendingLimitExhausted 表示成员自己的消费上限用完了。
	ErrOrganizationSpendingLimitExhausted = infraerrors.Forbidden(
		"ORGANIZATION_SPENDING_LIMIT_EXHAUSTED",
		"your spending limit has been used up, contact your organization admin",
	)
	// ErrOrganizationBalanceInsufficient 表示组织付款账号没钱了。
	// 提示里不带任何金额，成员看不到组织账户的具体情况。
	ErrOrganizationBalanceInsufficient = infraerrors.Forbidden(
		"ORGANIZATION_BALANCE_INSUFFICIENT",
		"organization balance is insufficient, contact your organization admin",
	)
)

// OrganizationSpendingRepository 读取组织成员已经占用掉的额度。
type OrganizationSpendingRepository interface {
	// GetMemberSpending 返回该成员的已消费金额加已冻结金额；不是组织成员时返回 0。
	GetMemberSpending(ctx context.Context, userID int64) (float64, error)
}

// SetOrganizationSpendingRepo 注入组织成员额度读取，构造后设置以避免循环依赖。
func (s *BillingCacheService) SetOrganizationSpendingRepo(repo OrganizationSpendingRepository) {
	s.organizationSpendingRepo = repo
}

// BillingPayerUserID 返回这次调用实际由谁付款。
// 组织普通成员付的是组织付款账号的钱，其余情况都是自己付自己的。
func BillingPayerUserID(user *User) int64 {
	if user == nil {
		return 0
	}
	if user.OrganizationPayerUserID > 0 {
		return user.OrganizationPayerUserID
	}
	return user.ID
}

// AuthGateBalance 返回鉴权层余额闸应该看的余额。
//
// 组织普通成员自己没有余额，看的是组织付款账号；其余情况看自己的。
func AuthGateBalance(user *User) float64 {
	if user == nil {
		return 0
	}
	if user.OrganizationPayerUserID > 0 {
		return user.OrganizationPayerBalance
	}
	return user.Balance
}

// IsOrganizationMemberPayer 判断这次调用是不是由组织付款账号出钱。
func IsOrganizationMemberPayer(user *User) bool {
	return user != nil && user.OrganizationPayerUserID > 0
}

// GetOrganizationMemberSpending 读取成员已占用的额度（已消费 + 已冻结）。
// 与余额一样先读缓存，未命中再回源数据库并异步建缓存。
func (s *BillingCacheService) GetOrganizationMemberSpending(ctx context.Context, userID int64) (float64, error) {
	if s == nil || s.organizationSpendingRepo == nil {
		return 0, nil
	}
	if s.cache != nil {
		if spending, err := s.cache.GetOrganizationMemberSpending(ctx, userID); err == nil {
			return spending, nil
		}
	}

	value, err, _ := s.organizationSpendingSF.Do(strconv.FormatInt(userID, 10), func() (any, error) {
		loadCtx, cancel := context.WithTimeout(context.Background(), balanceLoadTimeout)
		defer cancel()

		spending, err := s.organizationSpendingRepo.GetMemberSpending(loadCtx, userID)
		if err != nil {
			return nil, fmt.Errorf("get organization member spending: %w", err)
		}
		if s.cache != nil {
			if setErr := s.cache.SetOrganizationMemberSpending(context.WithoutCancel(loadCtx), userID, spending); setErr != nil {
				logger.LegacyPrintf("service.billing_cache",
					"warning: set organization member spending cache failed user=%d: %v", userID, setErr)
			}
		}
		return spending, nil
	})
	if err != nil {
		return 0, err
	}
	spending, _ := value.(float64)
	return spending, nil
}

// IncrementOrganizationMemberSpending 同步累加成员已占用的额度，让下一次调用立刻看到。
// 缓存未命中时静默跳过，由下次回源重建，避免凭空写出一个不完整的值。
func (s *BillingCacheService) IncrementOrganizationMemberSpending(userID int64, delta float64) {
	if s == nil || s.cache == nil || userID <= 0 || delta == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), cacheWriteTimeout)
	defer cancel()
	if err := s.cache.IncrOrganizationMemberSpending(ctx, userID, delta); err != nil {
		logger.LegacyPrintf("service.billing_cache",
			"ALERT: incr organization member spending cache failed user=%d delta=%f: %v", userID, delta, err)
	}
}

// InvalidateOrganizationMemberSpending 清掉成员已占用额度的缓存，下次调用重新回源。
func (s *BillingCacheService) InvalidateOrganizationMemberSpending(ctx context.Context, userID int64) error {
	if s == nil || s.cache == nil || userID <= 0 {
		return nil
	}
	return s.cache.InvalidateOrganizationMemberSpending(ctx, userID)
}

// checkOrganizationSpendingEligibility 判断组织成员还有没有额度可用。
//
// 上限留空表示不限额；上限为 0 表示完全不能消费；其余情况看「已消费 + 已冻结」
// 是否已经顶到上限。个人用户和组织创建者不进入这条分支。
func (s *BillingCacheService) checkOrganizationSpendingEligibility(ctx context.Context, user *User) error {
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
			"ALERT: organization member spending check failed for user %d: %v", user.ID, err)
		return ErrBillingServiceUnavailable.WithCause(err)
	}
	if s.circuitBreaker != nil {
		s.circuitBreaker.OnSuccess()
	}
	if spending >= limit {
		return ErrOrganizationSpendingLimitExhausted
	}
	return nil
}

// translateOrganizationBalanceError 把付款账号的余额不足换成组织口径的提示，
// 成员只知道要找组织管理员，看不到组织账户的余额。
func translateOrganizationBalanceError(err error, payerUserID, userID int64) error {
	if err == nil || payerUserID == userID {
		return err
	}
	if errors.Is(err, ErrInsufficientBalance) {
		return ErrOrganizationBalanceInsufficient
	}
	return err
}
