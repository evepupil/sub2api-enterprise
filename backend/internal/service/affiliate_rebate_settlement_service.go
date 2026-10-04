package service

import (
	"context"
	"sync"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
)

// affiliateSettleBatchSize 每轮最多处理多少个邀请人，剩下的下一轮接着转
const affiliateSettleBatchSize = 200

// AffiliatePendingRebateLister 找出还有返利没进余额的邀请人：可转的返利大于 0，或者有冻结期已到的返利。
// 返利仓库按需实现（企业版加的查询），没实现时不启动兜底。
type AffiliatePendingRebateLister interface {
	ListUsersWithPendingRebates(ctx context.Context, limit int) ([]int64, error)
}

// affiliateRebateSettler 把一个邀请人的返利转进余额（AffiliateService 实现，测试里换成替身）
type affiliateRebateSettler interface {
	SettleRebatesToBalance(ctx context.Context, userID int64) (float64, error)
}

// AffiliateRebateSettlementService 邀请返利自动到账的兜底：定时把还没进余额的返利转进邀请人余额。
// 骨架照 AccountExpiryService（Start / Stop / runOnce + ticker）。不看邀请返利总开关：
// 这里只转已经产生的返利，原有的「转入余额」接口也不看开关。
type AffiliateRebateSettlementService struct {
	lister   AffiliatePendingRebateLister
	settler  affiliateRebateSettler
	interval time.Duration
	stopCh   chan struct{}
	stopOnce sync.Once
	wg       sync.WaitGroup
}

func NewAffiliateRebateSettlementService(lister AffiliatePendingRebateLister, settler affiliateRebateSettler, interval time.Duration) *AffiliateRebateSettlementService {
	return &AffiliateRebateSettlementService{
		lister:   lister,
		settler:  settler,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

func (s *AffiliateRebateSettlementService) Start() {
	if s == nil || s.lister == nil || s.settler == nil || s.interval <= 0 {
		return
	}
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		ticker := time.NewTicker(s.interval)
		defer ticker.Stop()

		// 启动时先转一轮：改造前留下的可转返利上线后马上进余额
		s.runOnce()
		for {
			select {
			case <-ticker.C:
				s.runOnce()
			case <-s.stopCh:
				return
			}
		}
	}()
}

func (s *AffiliateRebateSettlementService) Stop() {
	if s == nil {
		return
	}
	s.stopOnce.Do(func() {
		close(s.stopCh)
	})
	s.wg.Wait()
}

// runOnce 转一轮，返回这一轮有多少个邀请人的返利进了余额
func (s *AffiliateRebateSettlementService) runOnce() int {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	userIDs, err := s.lister.ListUsersWithPendingRebates(ctx, affiliateSettleBatchSize)
	if err != nil {
		logger.LegacyPrintf("service.affiliate", "[AffiliateSettle] list users with pending rebates failed: %v", err)
		return 0
	}
	settled := 0
	for _, userID := range userIDs {
		transferred, err := s.settler.SettleRebatesToBalance(ctx, userID)
		if err != nil {
			logger.LegacyPrintf("service.affiliate", "[AffiliateSettle] settle rebates for user %d failed: %v", userID, err)
			continue
		}
		if transferred > 0 {
			settled++
		}
	}
	if settled > 0 {
		logger.LegacyPrintf("service.affiliate", "[AffiliateSettle] credited rebates to %d inviters", settled)
	}
	return settled
}
