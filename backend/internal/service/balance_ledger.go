package service

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// 账户余额流水（官网控制台账单页）。后端没有单独的流水表：在线充值付款成功后会生成一张兑换码给用户兑掉，
// 手动兑换码、管理员调整余额、邀请返利转入余额也都记成兑换记录；优惠码赠送记在优惠码使用记录里，
// 余额订单的退款记在充值订单上。这里把它们拼成一份只含余额变动的流水（不含每次调用的扣费），
// 每一笔之后的余额按「现在的余额」倒推：减去这笔之后的余额变动，加回这笔之后按钱包计费的调用扣费。

// 流水类型
const (
	BalanceLedgerTypeRecharge  = "recharge"  // 在线充值（付款成功的余额订单）
	BalanceLedgerTypeRedeem    = "redeem"    // 兑换码
	BalanceLedgerTypePromo     = "promo"     // 优惠码赠送
	BalanceLedgerTypeAffiliate = "affiliate" // 邀请返利转入余额
	BalanceLedgerTypeAdmin     = "admin"     // 管理员调整（可正可负）
	BalanceLedgerTypeRefund    = "refund"    // 余额订单退款（扣回余额）
)

// 流水来源：在线充值与退款是订单的支付方式（alipay、wxpay、stripe 等，原样返回），其余是下面几种
const (
	BalanceLedgerSourceRedeemCode = "redeem_code"
	BalanceLedgerSourcePromoCode  = "promo_code"
	BalanceLedgerSourceAffiliate  = "affiliate"
	BalanceLedgerSourceAdmin      = "admin"
)

// BalanceLedgerTypes 全部流水类型，用于校验筛选参数
var BalanceLedgerTypes = []string{
	BalanceLedgerTypeRecharge,
	BalanceLedgerTypeRedeem,
	BalanceLedgerTypePromo,
	BalanceLedgerTypeAffiliate,
	BalanceLedgerTypeAdmin,
	BalanceLedgerTypeRefund,
}

// BalanceLedgerEntry 一笔余额变动
type BalanceLedgerEntry struct {
	// ID 流水号：rc_ 兑换记录、pc_ 优惠码使用记录、rf_ 退款的订单，后面接记录 ID
	ID     string `json:"id"`
	Type   string `json:"type"`
	Source string `json:"source"`
	// Amount 带正负号：收入为正，管理员扣减与退款为负
	Amount float64 `json:"amount"`
	// BalanceAfter 这一笔之后的余额（倒推得出）
	BalanceAfter float64 `json:"balance_after"`
	// Reference 充值与退款是订单号，兑换码与优惠码是码本身
	Reference string `json:"reference"`
	// Note 管理员调整的备注、退款原因
	Note string `json:"note"`
	// PayAmount 在线充值实际支付的金额（支付渠道的币种），其它类型为空
	PayAmount *float64  `json:"pay_amount,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// BalanceLedgerFilter 流水筛选条件；金额范围按绝对值比较
type BalanceLedgerFilter struct {
	Type      string
	Source    string
	Query     string
	MinAmount *float64
	MaxAmount *float64
	StartTime *time.Time
	EndTime   *time.Time
}

// BalanceLedgerPage 一页流水，外加这个用户流水里出现过的全部来源（给筛选下拉用）
type BalanceLedgerPage struct {
	Items   []BalanceLedgerEntry
	Total   int64
	Sources []string
}

// BalanceSummary 账单页的余额卡：可用余额与开户以来的累计
type BalanceSummary struct {
	Balance float64 `json:"balance"`
	// TotalRecharged 在线充值加管理员加款
	TotalRecharged float64 `json:"total_recharged"`
	// TotalBonus 兑换码、优惠码与邀请返利转入
	TotalBonus float64 `json:"total_bonus"`
	// TotalConsumed 按钱包计费的调用扣费合计（订阅套餐内的调用不算）
	TotalConsumed float64 `json:"total_consumed"`
	// RecentConsumed 最近 RecentDays 天按钱包计费的调用扣费，页面用来算日均与可用天数
	RecentConsumed float64 `json:"recent_consumed"`
	RecentDays     int     `json:"recent_days"`
}

// BalanceSummaryRecentDays 算日均消耗看最近多少天
const BalanceSummaryRecentDays = 30

// BalanceLedgerRepository 余额流水的查询能力。单独成接口而不并入 RedeemCodeRepository，
// 免得兑换码仓库的测试替身都要跟着实现；仓库没实现时两个接口返回错误。
type BalanceLedgerRepository interface {
	GetUserBalanceSummary(ctx context.Context, userID int64, recentSince time.Time) (*BalanceSummary, error)
	ListUserBalanceLedger(ctx context.Context, userID int64, filter BalanceLedgerFilter, page, pageSize int) (*BalanceLedgerPage, error)
}

// errBalanceLedgerUnsupported 兑换码仓库没有实现余额流水查询
var errBalanceLedgerUnsupported = errors.New("balance ledger is not supported by the redeem code repository")

// GetUserBalanceSummary 可用余额与开户以来的累计充值、赠送、消耗
func (s *RedeemService) GetUserBalanceSummary(ctx context.Context, userID int64) (*BalanceSummary, error) {
	repo, ok := s.redeemRepo.(BalanceLedgerRepository)
	if !ok {
		return nil, errBalanceLedgerUnsupported
	}
	since := time.Now().Add(-BalanceSummaryRecentDays * 24 * time.Hour)
	summary, err := repo.GetUserBalanceSummary(ctx, userID, since)
	if err != nil {
		return nil, fmt.Errorf("get user balance summary: %w", err)
	}
	summary.RecentDays = BalanceSummaryRecentDays
	return summary, nil
}

// ListUserBalanceLedger 余额流水，按时间从新到旧分页
func (s *RedeemService) ListUserBalanceLedger(ctx context.Context, userID int64, filter BalanceLedgerFilter, page, pageSize int) (*BalanceLedgerPage, error) {
	repo, ok := s.redeemRepo.(BalanceLedgerRepository)
	if !ok {
		return nil, errBalanceLedgerUnsupported
	}
	result, err := repo.ListUserBalanceLedger(ctx, userID, filter, page, pageSize)
	if err != nil {
		return nil, fmt.Errorf("list user balance ledger: %w", err)
	}
	return result, nil
}
