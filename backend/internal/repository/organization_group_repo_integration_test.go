//go:build integration

package repository

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/ent/group"
	"github.com/Wei-Shaw/sub2api/ent/organizationallowedgroup"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func seedGroupsForOrganization(t *testing.T, ctx context.Context, count int) []int64 {
	t.Helper()

	suffix := time.Now().UnixNano()
	groupIDs := make([]int64, 0, count)
	for i := 0; i < count; i++ {
		created, err := integrationEntClient.Group.Create().
			SetName(fmt.Sprintf("org-scope-group-%d-%d", i, suffix)).
			Save(ctx)
		require.NoError(t, err)
		groupIDs = append(groupIDs, created.ID)
	}
	t.Cleanup(func() {
		cleanupCtx := context.Background()
		_, _ = integrationEntClient.OrganizationAllowedGroup.Delete().
			Where(organizationallowedgroup.GroupIDIn(groupIDs...)).Exec(cleanupCtx)
		_, _ = integrationEntClient.Group.Delete().Where(group.IDIn(groupIDs...)).Exec(cleanupCtx)
	})
	return groupIDs
}

func TestOrganizationGroupRepositoryDefaultScope(t *testing.T) {
	ctx := context.Background()
	organization, userIDs := seedOrganizationWithMembers(t, ctx, 1)
	repo := NewOrganizationGroupRepository(integrationEntClient)

	scope, err := repo.GetScopeByOrganizationID(ctx, organization.ID)
	require.NoError(t, err)
	require.False(t, scope.RestrictPublicGroups, "新建组织默认不限制公开分组")
	require.Empty(t, scope.AllowedGroupIDs, "新建组织没有任何专属分组授权")

	memberScope, err := repo.GetMemberScopeByUserID(ctx, userIDs[1])
	require.NoError(t, err)
	require.NotNil(t, memberScope)
	require.Equal(t, organization.ID, memberScope.OrganizationID)

	// 不属于任何组织的账号返回空范围，继续走账号自己的规则。
	personal, err := integrationEntClient.User.Create().
		SetEmail(fmt.Sprintf("org-scope-personal-%d@example.com", time.Now().UnixNano())).
		SetPasswordHash("test-password-hash").
		Save(ctx)
	require.NoError(t, err)
	t.Cleanup(func() { _ = integrationEntClient.User.DeleteOneID(personal.ID).Exec(context.Background()) })

	personalScope, err := repo.GetMemberScopeByUserID(ctx, personal.ID)
	require.NoError(t, err)
	require.Nil(t, personalScope)
}

func TestOrganizationGroupRepositorySetScopeReplaces(t *testing.T) {
	ctx := context.Background()
	organization, userIDs := seedOrganizationWithMembers(t, ctx, 1)
	groupIDs := seedGroupsForOrganization(t, ctx, 3)
	repo := NewOrganizationGroupRepository(integrationEntClient)

	require.NoError(t, repo.SetScope(ctx, organization.ID, true, groupIDs[:2]))
	scope, err := repo.GetMemberScopeByUserID(ctx, userIDs[1])
	require.NoError(t, err)
	require.True(t, scope.RestrictPublicGroups)
	require.ElementsMatch(t, groupIDs[:2], scope.AllowedGroupIDs)

	// 覆盖写入：上一版授权不能有残留。
	require.NoError(t, repo.SetScope(ctx, organization.ID, false, groupIDs[2:]))
	scope, err = repo.GetScopeByOrganizationID(ctx, organization.ID)
	require.NoError(t, err)
	require.False(t, scope.RestrictPublicGroups)
	require.ElementsMatch(t, groupIDs[2:], scope.AllowedGroupIDs)

	require.NoError(t, repo.SetScope(ctx, organization.ID, false, nil))
	scope, err = repo.GetScopeByOrganizationID(ctx, organization.ID)
	require.NoError(t, err)
	require.Empty(t, scope.AllowedGroupIDs)

	err = repo.SetScope(ctx, 0, false, nil)
	require.True(t, errors.Is(err, service.ErrOrganizationNotFound))

	memberIDs, err := repo.ListMemberUserIDs(ctx, organization.ID)
	require.NoError(t, err)
	require.ElementsMatch(t, userIDs, memberIDs)
}

func TestAdminOrganizationRepositoryListAndGet(t *testing.T) {
	ctx := context.Background()
	organization, userIDs := seedOrganizationWithMembers(t, ctx, 2)
	groupIDs := seedGroupsForOrganization(t, ctx, 1)
	require.NoError(t, NewOrganizationGroupRepository(integrationEntClient).
		SetScope(ctx, organization.ID, true, groupIDs))

	repo := NewAdminOrganizationRepository(integrationEntClient)
	detail, err := repo.Get(ctx, organization.ID)
	require.NoError(t, err)
	require.Equal(t, organization.Name, detail.Name)
	require.Equal(t, userIDs[0], detail.OwnerUserID)
	require.NotEmpty(t, detail.OwnerEmail)
	require.Equal(t, len(userIDs), detail.MemberCount, "成员数包含组织管理员本人")
	require.True(t, detail.RestrictPublicGroups)
	require.ElementsMatch(t, groupIDs, detail.AllowedGroupIDs)

	// 按组织管理员邮箱搜索也能定位到组织。
	found, result, err := repo.List(ctx, pagination.DefaultPagination(), service.AdminOrganizationListFilters{
		Search: detail.OwnerEmail,
	})
	require.NoError(t, err)
	require.EqualValues(t, 1, result.Total)
	require.Len(t, found, 1)
	require.Equal(t, organization.ID, found[0].ID)
	require.Equal(t, len(userIDs), found[0].MemberCount)

	_, err = repo.Get(ctx, 0)
	require.True(t, errors.Is(err, service.ErrOrganizationNotFound))
}

// 组织停用只作用在组织这一层，成员账号状态不受影响。
func TestOrganizationStatusSuspendsScopeOnly(t *testing.T) {
	ctx := context.Background()
	organization, userIDs := seedOrganizationWithMembers(t, ctx, 1)
	repo := NewOrganizationGroupRepository(integrationEntClient)

	scope, err := repo.GetMemberScopeByUserID(ctx, userIDs[1])
	require.NoError(t, err)
	require.False(t, scope.Disabled, "新建组织默认是启用的")

	require.NoError(t, repo.SetStatus(ctx, organization.ID, service.StatusDisabled))
	for _, userID := range userIDs {
		scope, err := repo.GetMemberScopeByUserID(ctx, userID)
		require.NoError(t, err)
		require.True(t, scope.Disabled, "组织创建者和普通成员都停")
	}

	var activeAccounts int
	require.NoError(t, integrationDB.QueryRowContext(ctx,
		"SELECT count(*) FROM users WHERE id = ANY($1) AND status = 'active'", pq.Array(userIDs),
	).Scan(&activeAccounts))
	require.Equal(t, len(userIDs), activeAccounts, "停用组织不改写任何成员账号")

	require.NoError(t, repo.SetStatus(ctx, organization.ID, service.StatusActive))
	scope, err = repo.GetMemberScopeByUserID(ctx, userIDs[1])
	require.NoError(t, err)
	require.False(t, scope.Disabled)

	require.True(t, errors.Is(repo.SetStatus(ctx, 0, service.StatusDisabled), service.ErrOrganizationNotFound))
}
