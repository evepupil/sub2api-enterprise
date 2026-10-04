package repository

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAffiliatePendingRebateUsersSQLCoversBothKinds(t *testing.T) {
	// 两类没进余额的返利都要找出来：可转的返利、冻结期已到还没解冻的返利；已注销的用户跳过
	for _, fragment := range []string{
		"FROM user_affiliates ua WHERE ua.aff_quota > 0",
		"ual.action = 'accrue' AND ual.frozen_until IS NOT NULL AND ual.frozen_until <= NOW()",
		"JOIN users u ON u.id = pending.user_id AND u.deleted_at IS NULL",
		"LIMIT $1",
	} {
		require.Contains(t, affiliatePendingRebateUsersSQL, fragment)
	}
}
