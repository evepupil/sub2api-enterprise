package repository

import (
	"context"
	"fmt"
)

// 企业版：邀请返利自动到账的兜底查询（说明见 service/affiliate_auto_settle.go）。

// affiliatePendingRebateUsersSQL 还有返利没进余额的邀请人：可转的返利大于 0，或者有冻结期已到、还没解冻的返利。
// 已注销的用户跳过（转账会找不到用户，每分钟重试只会刷错误日志）。$1 是这一轮最多处理的人数。
const affiliatePendingRebateUsersSQL = `
SELECT pending.user_id
FROM (
	SELECT ua.user_id FROM user_affiliates ua WHERE ua.aff_quota > 0
	UNION
	SELECT ual.user_id FROM user_affiliate_ledger ual
	WHERE ual.action = 'accrue' AND ual.frozen_until IS NOT NULL AND ual.frozen_until <= NOW()
) pending
JOIN users u ON u.id = pending.user_id AND u.deleted_at IS NULL
ORDER BY pending.user_id
LIMIT $1`

// ListUsersWithPendingRebates 实现 service.AffiliatePendingRebateLister
func (r *affiliateRepository) ListUsersWithPendingRebates(ctx context.Context, limit int) ([]int64, error) {
	if limit <= 0 {
		return []int64{}, nil
	}
	rows, err := clientFromContext(ctx, r.client).QueryContext(ctx, affiliatePendingRebateUsersSQL, limit)
	if err != nil {
		return nil, fmt.Errorf("query users with pending affiliate rebates: %w", err)
	}
	defer func() { _ = rows.Close() }()

	userIDs := make([]int64, 0, limit)
	for rows.Next() {
		var userID int64
		if err := rows.Scan(&userID); err != nil {
			return nil, fmt.Errorf("scan user with pending affiliate rebates: %w", err)
		}
		userIDs = append(userIDs, userID)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate users with pending affiliate rebates: %w", err)
	}
	return userIDs, nil
}
