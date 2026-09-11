package handler

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// 组织范围下能看本组织成员的密钥用量，看不到组织外的。
func TestUsageActorOwnsAPIKey(t *testing.T) {
	const actor = int64(1)
	organizationMembers := []int64{actor, 2, 3}

	require.True(t, usageActorOwnsAPIKey(actor, actor, actor, nil), "自己的密钥永远能看")
	require.False(t, usageActorOwnsAPIKey(9, actor, actor, nil), "个人范围下别人的密钥看不了")

	require.True(t, usageActorOwnsAPIKey(2, actor, 0, organizationMembers), "组织范围下成员的密钥能看")
	require.False(t, usageActorOwnsAPIKey(9, actor, 0, organizationMembers), "组织外的密钥仍然看不了")

	// 组织范围内再按单个成员筛选时，范围收窄到这个成员。
	require.True(t, usageActorOwnsAPIKey(2, actor, 2, nil))
	require.False(t, usageActorOwnsAPIKey(3, actor, 2, nil))
}

func TestContainsUserID(t *testing.T) {
	require.True(t, containsUserID([]int64{1, 2, 3}, 2))
	require.False(t, containsUserID([]int64{1, 2, 3}, 9))
	require.False(t, containsUserID(nil, 1))
}
