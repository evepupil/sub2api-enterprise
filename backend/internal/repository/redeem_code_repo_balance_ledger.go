package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

// 官网控制台账单页的余额流水与余额卡（说明见 service/balance_ledger.go）。
// 一个用户的余额变动记录不多（充值、兑换、调整，通常几十到几百条），流水整份在库里拼好再筛选分页；
// 只有「每一笔之后的余额」要加回这笔之后的调用扣费，这一项只对当前页的几行按用户与时间查使用记录。

// balanceLedgerCTE 把兑换记录（含在线充值、管理员调整）、邀请返利转入、优惠码使用记录、余额订单退款
// 拼成一份流水，$1 是用户 ID。兑换记录能对上某个充值订单的兑换码时算在线充值，来源取订单的支付方式。
// 邀请返利转入记在邀请返利流水（action = 'transfer'）里，编号照管理端余额记录写成 AFF-序号；
// 兑换记录里的 affiliate_balance 类只有旧数据才有，照样算进来（管理端也是两处合并显示）。
const balanceLedgerCTE = `WITH ledger AS (
	SELECT 'rc_' || rc.id AS id,
		CASE
			WHEN rc.type = 'admin_balance' THEN 'admin'
			WHEN rc.type = 'affiliate_balance' THEN 'affiliate'
			WHEN po.id IS NOT NULL THEN 'recharge'
			ELSE 'redeem'
		END AS type,
		CASE
			WHEN rc.type = 'admin_balance' THEN 'admin'
			WHEN rc.type = 'affiliate_balance' THEN 'affiliate'
			WHEN po.id IS NOT NULL THEN COALESCE(NULLIF(po.payment_type, ''), 'online')
			ELSE 'redeem_code'
		END AS source,
		rc.value::double precision AS amount,
		rc.used_at AS created_at,
		COALESCE(NULLIF(po.out_trade_no, ''), rc.code) AS reference,
		COALESCE(rc.notes, '') AS note,
		po.pay_amount::double precision AS pay_amount
	FROM redeem_codes rc
	LEFT JOIN payment_orders po ON po.recharge_code = rc.code AND po.user_id = rc.used_by
	WHERE rc.used_by = $1 AND rc.status = 'used' AND rc.used_at IS NOT NULL
		AND rc.type IN ('balance', 'admin_balance', 'affiliate_balance')
	UNION ALL
	SELECT 'af_' || ual.id, 'affiliate', 'affiliate', ual.amount::double precision, ual.created_at,
		'AFF-' || ual.id, '', NULL::double precision
	FROM user_affiliate_ledger ual
	WHERE ual.user_id = $1 AND ual.action = 'transfer' AND ual.amount > 0
	UNION ALL
	SELECT 'pc_' || pcu.id, 'promo', 'promo_code', pcu.bonus_amount::double precision, pcu.used_at,
		COALESCE(pc.code, ''), '', NULL::double precision
	FROM promo_code_usages pcu
	LEFT JOIN promo_codes pc ON pc.id = pcu.promo_code_id
	WHERE pcu.user_id = $1 AND pcu.bonus_amount <> 0
	UNION ALL
	SELECT 'rf_' || po.id, 'refund', COALESCE(NULLIF(po.payment_type, ''), 'online'),
		-po.refund_amount::double precision, po.refund_at, COALESCE(NULLIF(po.out_trade_no, ''), ''),
		COALESCE(po.refund_reason, ''), NULL::double precision
	FROM payment_orders po
	WHERE po.user_id = $1 AND po.order_type = 'balance' AND po.refund_at IS NOT NULL AND po.refund_amount > 0
)`

// balanceLedgerConsumedAfter 某个时刻之后按钱包计费（billing_type = 0）的调用扣费，$1 是用户 ID
const balanceLedgerConsumedAfter = `COALESCE((SELECT SUM(ul.actual_cost) FROM usage_logs ul
	WHERE ul.user_id = $1 AND ul.billing_type = 0 AND ul.created_at > p.created_at), 0)::double precision`

// GetUserBalanceSummary 可用余额、开户以来的累计充值（在线充值加管理员加款）、累计赠送（兑换码、优惠码、
// 邀请返利转入）、累计消耗与最近一段时间的消耗（都只算按钱包计费的调用）。
func (r *redeemCodeRepository) GetUserBalanceSummary(ctx context.Context, userID int64, recentSince time.Time) (*service.BalanceSummary, error) {
	client := clientFromContext(ctx, r.client)
	summary := &service.BalanceSummary{}

	found, err := queryBalanceRow(ctx, client,
		`SELECT balance::double precision FROM users WHERE id = $1 AND deleted_at IS NULL`,
		[]any{userID}, &summary.Balance)
	if err != nil {
		return nil, fmt.Errorf("query balance: %w", err)
	}
	if !found {
		return nil, service.ErrUserNotFound
	}

	if _, err := queryBalanceRow(ctx, client, balanceLedgerCTE+`
SELECT
	COALESCE(SUM(amount) FILTER (WHERE type = 'recharge' OR (type = 'admin' AND amount > 0)), 0)::double precision,
	COALESCE(SUM(amount) FILTER (WHERE type IN ('redeem', 'promo', 'affiliate')), 0)::double precision
FROM ledger`, []any{userID}, &summary.TotalRecharged, &summary.TotalBonus); err != nil {
		return nil, fmt.Errorf("query balance ledger totals: %w", err)
	}

	if _, err := queryBalanceRow(ctx, client, `
SELECT
	COALESCE(SUM(actual_cost), 0)::double precision,
	COALESCE(SUM(actual_cost) FILTER (WHERE created_at >= $2), 0)::double precision
FROM usage_logs WHERE user_id = $1 AND billing_type = 0`, []any{userID, recentSince}, &summary.TotalConsumed, &summary.RecentConsumed); err != nil {
		return nil, fmt.Errorf("query consumed totals: %w", err)
	}
	return summary, nil
}

// ListUserBalanceLedger 按时间从新到旧分页；筛选只影响显示哪些行，每一笔之后的余额始终按完整流水倒推。
func (r *redeemCodeRepository) ListUserBalanceLedger(ctx context.Context, userID int64, filter service.BalanceLedgerFilter, page, pageSize int) (*service.BalanceLedgerPage, error) {
	client := clientFromContext(ctx, r.client)
	where, args := balanceLedgerWhere(filter, []any{userID})
	result := &service.BalanceLedgerPage{Items: []service.BalanceLedgerEntry{}, Sources: []string{}}

	if _, err := queryBalanceRow(ctx, client, balanceLedgerCTE+`
SELECT COUNT(*) FROM ledger`+where, args, &result.Total); err != nil {
		return nil, fmt.Errorf("count balance ledger: %w", err)
	}

	sources, err := client.QueryContext(ctx, balanceLedgerCTE+`
SELECT DISTINCT source FROM ledger ORDER BY source`, userID)
	if err != nil {
		return nil, fmt.Errorf("query balance ledger sources: %w", err)
	}
	if err := scanBalanceSources(sources, &result.Sources); err != nil {
		return nil, fmt.Errorf("scan balance ledger sources: %w", err)
	}

	if result.Total == 0 {
		return result, nil
	}
	limitAt, offsetAt := len(args)+1, len(args)+2
	pageArgs := append(append([]any{}, args...), pageSize, (page-1)*pageSize)
	rows, err := client.QueryContext(ctx, balanceLedgerCTE+`,
ordered AS (
	SELECT l.*, COALESCE(SUM(l.amount) OVER (
		ORDER BY l.created_at DESC, l.id DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS later_amount
	FROM ledger l
),
page AS (
	SELECT * FROM ordered`+where+`
	ORDER BY created_at DESC, id DESC
	LIMIT $`+fmt.Sprint(limitAt)+` OFFSET $`+fmt.Sprint(offsetAt)+`
)
SELECT p.id, p.type, p.source, p.amount, p.created_at, p.reference, p.note, p.pay_amount,
	(SELECT balance FROM users WHERE id = $1)::double precision - p.later_amount + `+balanceLedgerConsumedAfter+`
FROM page p
ORDER BY p.created_at DESC, p.id DESC`, pageArgs...)
	if err != nil {
		return nil, fmt.Errorf("query balance ledger page: %w", err)
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var entry service.BalanceLedgerEntry
		var payAmount sql.NullFloat64
		if err := rows.Scan(&entry.ID, &entry.Type, &entry.Source, &entry.Amount, &entry.CreatedAt,
			&entry.Reference, &entry.Note, &payAmount, &entry.BalanceAfter); err != nil {
			return nil, fmt.Errorf("scan balance ledger row: %w", err)
		}
		if payAmount.Valid {
			value := payAmount.Float64
			entry.PayAmount = &value
		}
		result.Items = append(result.Items, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate balance ledger rows: %w", err)
	}
	return result, nil
}

// balanceLedgerWhere 把筛选条件拼成 WHERE 子句（作用在 ledger 的列上），参数从 args 之后接着编号
func balanceLedgerWhere(filter service.BalanceLedgerFilter, args []any) (string, []any) {
	clauses := []string{}
	add := func(clause string, value any) {
		args = append(args, value)
		clauses = append(clauses, fmt.Sprintf(clause, len(args)))
	}
	if filter.Type != "" {
		add("type = $%d", filter.Type)
	}
	if filter.Source != "" {
		add("source = $%d", filter.Source)
	}
	if q := strings.TrimSpace(filter.Query); q != "" {
		// 用户输入的 % 与 _ 按字面匹配
		pattern := "%" + escapeLike(q) + "%"
		args = append(args, pattern)
		clauses = append(clauses, fmt.Sprintf("(id ILIKE $%[1]d OR reference ILIKE $%[1]d)", len(args)))
	}
	if filter.MinAmount != nil {
		add("ABS(amount) >= $%d", *filter.MinAmount)
	}
	if filter.MaxAmount != nil {
		add("ABS(amount) <= $%d", *filter.MaxAmount)
	}
	if filter.StartTime != nil {
		add("created_at >= $%d", *filter.StartTime)
	}
	if filter.EndTime != nil {
		add("created_at < $%d", *filter.EndTime)
	}
	if len(clauses) == 0 {
		return "", args
	}
	return "\nWHERE " + strings.Join(clauses, " AND "), args
}

// queryBalanceRow 查一行并扫进 dest；没有行时 found 为 false
func queryBalanceRow(ctx context.Context, client *dbent.Client, query string, args []any, dest ...any) (bool, error) {
	rows, err := client.QueryContext(ctx, query, args...)
	if err != nil {
		return false, err
	}
	defer func() { _ = rows.Close() }()
	if !rows.Next() {
		return false, rows.Err()
	}
	if err := rows.Scan(dest...); err != nil {
		return false, err
	}
	return true, rows.Close()
}

// scanBalanceSources 把单列字符串结果读进切片
func scanBalanceSources(rows *sql.Rows, out *[]string) error {
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return err
		}
		*out = append(*out, value)
	}
	return rows.Err()
}
