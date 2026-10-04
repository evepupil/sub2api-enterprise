package service

import (
	"context"
	"errors"

	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
)

// 邀请返利自动到账（企业版）：返利记上之后直接转进邀请人余额，邀请人不用打开页面、不用手动点「转入余额」。
// 转账复用原有的 TransferQuotaToBalance（先把到期的冻结返利解冻，再把可转的返利全部转进余额，
// 记一条 transfer 流水），所以账单页的余额流水、管理端的转入记录都照常能看到每一笔。
//
// 触发点有两个：
//   - 返利落库之后马上转（AccrueInviteRebateForOrder 不在调用方事务里时直接转；在线充值那条路在事务里，
//     由 PaymentService 在事务提交后调用 SettleInviterOf）；
//   - 每分钟的兜底（AffiliateRebateSettlementService）：冻结期刚到期的、上面那一步失败的、改造前留下没转的，
//     都在这里转进去。

// SettleRebatesToBalance 把某个邀请人能转的返利全部转进余额；没有可转的返利时什么都不做，返回 0。
func (s *AffiliateService) SettleRebatesToBalance(ctx context.Context, userID int64) (float64, error) {
	transferred, _, err := s.TransferAffiliateQuota(ctx, userID)
	if errors.Is(err, ErrAffiliateQuotaEmpty) {
		return 0, nil
	}
	return transferred, err
}

// SettleInviterOf 被邀请人充值产生返利、事务提交之后调用：找到他的邀请人，把返利转进邀请人余额。
// 尽力而为，失败只记日志，每分钟的兜底会再转。
func (s *AffiliateService) SettleInviterOf(ctx context.Context, inviteeUserID int64) {
	if s == nil || s.repo == nil || inviteeUserID <= 0 {
		return
	}
	invitee, err := s.repo.EnsureUserAffiliate(ctx, inviteeUserID)
	if err != nil {
		logger.LegacyPrintf("service.affiliate", "[Affiliate] auto settle: load invitee %d failed: %v", inviteeUserID, err)
		return
	}
	if invitee.InviterID == nil || *invitee.InviterID <= 0 {
		return
	}
	s.settleBestEffort(ctx, *invitee.InviterID)
}

// settleBestEffort 把邀请人的返利转进余额，失败只记日志（每分钟的兜底会再转）
func (s *AffiliateService) settleBestEffort(ctx context.Context, inviterID int64) {
	transferred, err := s.SettleRebatesToBalance(ctx, inviterID)
	if err != nil {
		logger.LegacyPrintf("service.affiliate", "[Affiliate] auto settle for inviter %d failed, retry in background: %v", inviterID, err)
		return
	}
	if transferred > 0 {
		logger.LegacyPrintf("service.affiliate", "[Affiliate] auto settled %.8f to balance of inviter %d", transferred, inviterID)
	}
}
