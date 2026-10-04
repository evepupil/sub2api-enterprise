package repository

import (
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestBalanceLedgerWhereWithoutFilters(t *testing.T) {
	where, args := balanceLedgerWhere(service.BalanceLedgerFilter{}, []any{int64(42)})
	require.Empty(t, where)
	require.Equal(t, []any{int64(42)}, args)
}

func TestBalanceLedgerWhereNumbersParametersAfterUserID(t *testing.T) {
	minAmount, maxAmount := 1.0, 50.0
	start := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	where, args := balanceLedgerWhere(service.BalanceLedgerFilter{
		Type: "recharge", Source: "alipay", Query: " sub2_ ",
		MinAmount: &minAmount, MaxAmount: &maxAmount, StartTime: &start, EndTime: &end,
	}, []any{int64(42)})

	require.Equal(t, "\nWHERE type = $2 AND source = $3 AND (id ILIKE $4 OR reference ILIKE $4)"+
		" AND ABS(amount) >= $5 AND ABS(amount) <= $6 AND created_at >= $7 AND created_at < $8", where)
	// 搜索词去掉首尾空白；下划线是 LIKE 的通配符，转义后按字面匹配
	require.Equal(t, []any{int64(42), "recharge", "alipay", `%sub2\_%`, 1.0, 50.0, start, end}, args)
}

func TestBalanceLedgerCTECoversEveryBalanceChange(t *testing.T) {
	// 流水只含余额变动：兑换记录里的余额类（在线充值、兑换码、管理员调整、邀请返利转入）、优惠码赠送、余额订单退款
	for _, fragment := range []string{
		"rc.type IN ('balance', 'admin_balance', 'affiliate_balance')",
		"LEFT JOIN payment_orders po ON po.recharge_code = rc.code AND po.user_id = rc.used_by",
		"FROM promo_code_usages pcu",
		"po.order_type = 'balance' AND po.refund_at IS NOT NULL AND po.refund_amount > 0",
	} {
		require.True(t, strings.Contains(balanceLedgerCTE, fragment), fragment)
	}
	// 每一笔之后的余额只加回按钱包计费的调用扣费（订阅套餐内的调用不动余额）
	require.Contains(t, balanceLedgerConsumedAfter, "ul.billing_type = 0")
}
