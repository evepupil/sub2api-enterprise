package service

import (
	"context"
	"errors"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"

	"github.com/stretchr/testify/require"
)

type organizationGroupRepoStub struct {
	scopeByUser  map[int64]*OrganizationMemberScope
	scopes       map[int64]*OrganizationMemberScope
	memberIDs    map[int64][]int64
	writes       []OrganizationMemberScope
	statusWrites []string
	err          error
}

func (r *organizationGroupRepoStub) GetMemberScopeByUserID(_ context.Context, userID int64) (*OrganizationMemberScope, error) {
	if r.err != nil {
		return nil, r.err
	}
	scope, ok := r.scopeByUser[userID]
	if !ok {
		return nil, nil
	}
	copyValue := *scope
	return &copyValue, nil
}

func (r *organizationGroupRepoStub) GetScopeByOrganizationID(_ context.Context, organizationID int64) (*OrganizationMemberScope, error) {
	scope, ok := r.scopes[organizationID]
	if !ok {
		return nil, ErrOrganizationNotFound
	}
	copyValue := *scope
	return &copyValue, nil
}

func (r *organizationGroupRepoStub) SetScope(_ context.Context, organizationID int64, restrictPublicGroups bool, groupIDs []int64) error {
	if r.err != nil {
		return r.err
	}
	scope := OrganizationMemberScope{
		OrganizationID:       organizationID,
		RestrictPublicGroups: restrictPublicGroups,
		AllowedGroupIDs:      append([]int64(nil), groupIDs...),
	}
	r.writes = append(r.writes, scope)
	r.scopes[organizationID] = &scope
	return nil
}

func (r *organizationGroupRepoStub) ListMemberUserIDs(_ context.Context, organizationID int64) ([]int64, error) {
	return r.memberIDs[organizationID], nil
}

func (r *organizationGroupRepoStub) SetStatus(_ context.Context, organizationID int64, status string) error {
	scope, ok := r.scopes[organizationID]
	if !ok {
		return ErrOrganizationNotFound
	}
	scope.Disabled = status == StatusDisabled
	r.statusWrites = append(r.statusWrites, status)
	return nil
}

type adminOrganizationRepoStub struct {
	organizations map[int64]*AdminOrganization
}

func (r *adminOrganizationRepoStub) List(
	_ context.Context,
	params pagination.PaginationParams,
	_ AdminOrganizationListFilters,
) ([]AdminOrganization, *pagination.PaginationResult, error) {
	out := make([]AdminOrganization, 0, len(r.organizations))
	for _, organization := range r.organizations {
		out = append(out, *organization)
	}
	return out, &pagination.PaginationResult{Total: int64(len(out)), Page: params.Page, PageSize: params.Limit(), Pages: 1}, nil
}

func (r *adminOrganizationRepoStub) Get(_ context.Context, organizationID int64) (*AdminOrganization, error) {
	organization, ok := r.organizations[organizationID]
	if !ok {
		return nil, ErrOrganizationNotFound
	}
	copyValue := *organization
	return &copyValue, nil
}

type groupRepoStub struct {
	GroupRepository
	groups map[int64]*Group
}

func (r *groupRepoStub) GetByID(_ context.Context, id int64) (*Group, error) {
	group, ok := r.groups[id]
	if !ok {
		return nil, ErrGroupNotFound
	}
	copyValue := *group
	return &copyValue, nil
}

func TestApplyScopeToUserLeavesPersonalUserUntouched(t *testing.T) {
	repo := &organizationGroupRepoStub{scopeByUser: map[int64]*OrganizationMemberScope{}}
	service := NewOrganizationGroupService(repo)

	user := &User{ID: 7, AllowedGroups: []int64{3}, RestrictPublicGroups: true}
	require.NoError(t, service.ApplyScopeToUser(context.Background(), user))
	require.Nil(t, user.OrganizationID)
	require.Equal(t, []int64{3}, user.AllowedGroups)
	require.True(t, user.RestrictPublicGroups)
}

func TestApplyScopeToUserReplacesPersonalRules(t *testing.T) {
	repo := &organizationGroupRepoStub{scopeByUser: map[int64]*OrganizationMemberScope{
		7: {OrganizationID: 5, RestrictPublicGroups: true, AllowedGroupIDs: []int64{11, 12}},
	}}
	service := NewOrganizationGroupService(repo)

	user := &User{ID: 7, AllowedGroups: []int64{3}, RestrictPublicGroups: false}
	require.NoError(t, service.ApplyScopeToUser(context.Background(), user))
	require.NotNil(t, user.OrganizationID)
	require.EqualValues(t, 5, *user.OrganizationID)
	require.True(t, user.RestrictPublicGroups)
	require.Equal(t, []int64{11, 12}, user.AllowedGroups)
	require.False(t, user.OrganizationDisabled)
}

func TestApplyScopeToUserFailsClosed(t *testing.T) {
	repo := &organizationGroupRepoStub{err: errors.New("database unavailable")}
	service := NewOrganizationGroupService(repo)

	user := &User{ID: 7}
	require.Error(t, service.ApplyScopeToUser(context.Background(), user), "读不出组织范围时必须报错，不能回退到账号自己的规则")
	require.Nil(t, user.OrganizationID)
}

// 组织付款账号的余额变化要连带清掉全体成员的鉴权缓存。
func TestMemberUserIDsOfOwnedOrganization(t *testing.T) {
	repo := &organizationGroupRepoStub{
		scopeByUser: map[int64]*OrganizationMemberScope{
			1: {OrganizationID: 5, OwnerUserID: 1, IsOwner: true},
			2: {OrganizationID: 5, OwnerUserID: 1},
		},
		memberIDs: map[int64][]int64{5: {1, 2, 3}},
	}
	service := NewOrganizationGroupService(repo)
	ctx := context.Background()

	members, err := service.MemberUserIDsOfOwnedOrganization(ctx, 1)
	require.NoError(t, err)
	require.Equal(t, []int64{2, 3}, members, "创建者本人单独清，不重复列出")

	members, err = service.MemberUserIDsOfOwnedOrganization(ctx, 2)
	require.NoError(t, err)
	require.Empty(t, members, "普通成员的余额变化不影响别人")

	members, err = service.MemberUserIDsOfOwnedOrganization(ctx, 99)
	require.NoError(t, err)
	require.Empty(t, members, "个人用户没有组织")
}

// 组织停用是整体停服：普通成员和组织创建者都拒，个人用户不受影响。
func TestCheckOrganizationEnabled(t *testing.T) {
	organizationID := int64(5)

	require.NoError(t, checkOrganizationEnabled(nil))
	require.NoError(t, checkOrganizationEnabled(&User{ID: 9}), "个人用户不进入组织判断")
	require.NoError(t, checkOrganizationEnabled(&User{ID: 2, OrganizationID: &organizationID}))

	member := &User{ID: 2, OrganizationID: &organizationID, OrganizationDisabled: true}
	require.ErrorIs(t, checkOrganizationEnabled(member), ErrOrganizationDisabled)

	owner := &User{ID: 1, OrganizationID: &organizationID, OrganizationDisabled: true}
	require.ErrorIs(t, checkOrganizationEnabled(owner), ErrOrganizationDisabled, "组织创建者本人也停")
}

// 组织停用属于权限，简易运行模式下同样拦截。
func TestCheckBillingEligibilityRejectsDisabledOrganization(t *testing.T) {
	billing := &BillingCacheService{cfg: &config.Config{RunMode: config.RunModeSimple}}
	organizationID := int64(5)
	member := &User{ID: 2, OrganizationID: &organizationID, OrganizationDisabled: true}

	err := billing.CheckBillingEligibility(context.Background(), member, nil, &Group{ID: 11}, nil, "")
	require.ErrorIs(t, err, ErrOrganizationDisabled)
}

func TestAdminOrganizationUpdateStatus(t *testing.T) {
	service, groups, authCache := newAdminOrganizationFixture()
	ctx := context.Background()

	_, err := service.UpdateStatus(ctx, 5, "paused")
	require.ErrorIs(t, err, ErrOrganizationStatusInvalid)
	require.Empty(t, groups.statusWrites)

	_, err = service.UpdateStatus(ctx, 404, StatusDisabled)
	require.ErrorIs(t, err, ErrOrganizationNotFound)

	_, err = service.UpdateStatus(ctx, 5, StatusDisabled)
	require.NoError(t, err)
	require.Equal(t, []string{StatusDisabled}, groups.statusWrites)
	require.Equal(t, []int64{1, 2, 3}, authCache.invalidatedUserIDs, "停用后立刻清掉全体成员的鉴权缓存")
}

func TestCheckOrganizationGroupAccess(t *testing.T) {
	organizationID := int64(5)
	publicGroup := &Group{ID: 11, IsExclusive: false}
	exclusiveGroup := &Group{ID: 12, IsExclusive: true}

	personal := &User{ID: 1}
	require.NoError(t, checkOrganizationGroupAccess(personal, exclusiveGroup), "个人用户不进入组织校验")

	openMember := &User{ID: 2, OrganizationID: &organizationID}
	require.NoError(t, checkOrganizationGroupAccess(openMember, publicGroup), "默认范围下公开分组可用")
	require.ErrorIs(t, checkOrganizationGroupAccess(openMember, exclusiveGroup), ErrOrganizationGroupForbidden,
		"默认范围下专属分组不可用")

	grantedMember := &User{ID: 3, OrganizationID: &organizationID, AllowedGroups: []int64{12}}
	require.NoError(t, checkOrganizationGroupAccess(grantedMember, exclusiveGroup))

	restrictedMember := &User{ID: 4, OrganizationID: &organizationID, RestrictPublicGroups: true, AllowedGroups: []int64{12}}
	require.ErrorIs(t, checkOrganizationGroupAccess(restrictedMember, publicGroup), ErrOrganizationGroupForbidden,
		"打开限制后没勾中的公开分组也不可用")
	require.NoError(t, checkOrganizationGroupAccess(restrictedMember, exclusiveGroup))
}

// 组织分组授权是权限而不是计费规则，简易运行模式下同样要拦住。
func TestCheckBillingEligibilityEnforcesOrganizationGroupsInSimpleMode(t *testing.T) {
	billing := &BillingCacheService{cfg: &config.Config{RunMode: config.RunModeSimple}}
	organizationID := int64(5)
	member := &User{ID: 2, OrganizationID: &organizationID}

	err := billing.CheckBillingEligibility(context.Background(), member, nil, &Group{ID: 12, IsExclusive: true}, nil, "")
	require.ErrorIs(t, err, ErrOrganizationGroupForbidden)

	require.NoError(t, billing.CheckBillingEligibility(
		context.Background(), member, nil, &Group{ID: 11, IsExclusive: false}, nil, ""))
}

func newAdminOrganizationFixture() (*AdminOrganizationService, *organizationGroupRepoStub, *organizationAuthCacheStub) {
	organizations := &adminOrganizationRepoStub{organizations: map[int64]*AdminOrganization{
		5: {ID: 5, Name: "Acme", OwnerUserID: 1, MemberCount: 3},
	}}
	groups := &organizationGroupRepoStub{
		scopeByUser: map[int64]*OrganizationMemberScope{},
		scopes: map[int64]*OrganizationMemberScope{
			5: {OrganizationID: 5},
		},
		memberIDs: map[int64][]int64{5: {1, 2, 3}},
	}
	groupRepo := &groupRepoStub{groups: map[int64]*Group{
		11: {ID: 11},
		12: {ID: 12, IsExclusive: true},
	}}
	authCache := &organizationAuthCacheStub{}
	return NewAdminOrganizationService(organizations, groups, groupRepo, authCache), groups, authCache
}

func TestAdminOrganizationUpdateGroups(t *testing.T) {
	service, groups, authCache := newAdminOrganizationFixture()
	ctx := context.Background()

	_, err := service.UpdateGroups(ctx, 5, true, []int64{12, 99})
	require.ErrorIs(t, err, ErrOrganizationGroupInvalid)
	require.Empty(t, groups.writes, "存在无效分组时整笔不写入")

	_, err = service.UpdateGroups(ctx, 404, false, nil)
	require.ErrorIs(t, err, ErrOrganizationNotFound)

	updated, err := service.UpdateGroups(ctx, 5, true, []int64{12, 11, 12})
	require.NoError(t, err)
	require.NotNil(t, updated)
	require.Len(t, groups.writes, 1)
	require.Equal(t, []int64{11, 12}, groups.writes[0].AllowedGroupIDs, "重复分组去重并按标识排序")
	require.True(t, groups.writes[0].RestrictPublicGroups)
	require.Equal(t, []int64{1, 2, 3}, authCache.invalidatedUserIDs, "授权一改就要清掉全部成员的鉴权缓存")
}
