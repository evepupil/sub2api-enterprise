package service

import (
	"context"
	"sort"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

var ErrOrganizationGroupInvalid = infraerrors.BadRequest(
	"ORGANIZATION_GROUP_INVALID",
	"one or more groups do not exist",
)

// ErrOrganizationGroupForbidden 用于调用前的拦截：密钥绑定的分组已经不在组织范围内。
var ErrOrganizationGroupForbidden = infraerrors.Forbidden(
	"ORGANIZATION_GROUP_FORBIDDEN",
	"this group is no longer authorized for your organization",
)

// OrganizationMemberScope 是一个账号因为属于组织而适用的全部规则：能用哪些分组、
// 这次调用由谁付款、自己的消费上限是多少。
//
// 分组判断规则与账号侧完全一致：
//
//	RestrictPublicGroups = false → 公开分组全部可用，专属分组只认 AllowedGroupIDs
//	RestrictPublicGroups = true  → 公开分组也必须落在 AllowedGroupIDs 里
//
// 新建组织没有任何授权记录，落到的就是「公开分组全放、专属分组全不给」。
//
// 组织创建者本人付自己的钱、不受成员消费上限约束，所以 IsOwner 为 true 时
// SpendingLimit 不参与判断。
type OrganizationMemberScope struct {
	OrganizationID       int64
	OwnerUserID          int64
	IsOwner              bool
	RestrictPublicGroups bool
	AllowedGroupIDs      []int64
	SpendingLimit        *float64
	// OwnerBalance 是组织付款账号当前的余额，供鉴权层的余额闸使用。
	OwnerBalance float64
}

type OrganizationGroupRepository interface {
	// GetMemberScopeByUserID 返回该账号因所属组织而适用的规则；账号不属于任何组织时返回 nil。
	GetMemberScopeByUserID(ctx context.Context, userID int64) (*OrganizationMemberScope, error)
	GetScopeByOrganizationID(ctx context.Context, organizationID int64) (*OrganizationMemberScope, error)
	// SetScope 覆盖写入组织的分组范围，开关和分组清单一起生效。
	SetScope(ctx context.Context, organizationID int64, restrictPublicGroups bool, groupIDs []int64) error
	ListMemberUserIDs(ctx context.Context, organizationID int64) ([]int64, error)
}

// OrganizationGroupScopeResolver 把组织的分组范围套到账号上，供密钥服务和鉴权快照使用。
type OrganizationGroupScopeResolver interface {
	ApplyScopeToUser(ctx context.Context, user *User) error
	// MemberUserIDsOfOwnedOrganization 返回该账号作为创建者所拥有组织的全部成员；
	// 账号不是任何组织的创建者时返回空。
	MemberUserIDsOfOwnedOrganization(ctx context.Context, ownerUserID int64) ([]int64, error)
}

// OrganizationGroupService 负责组织分组范围的读取与套用。
// 平台侧的组织管理接口在 admin_organization.go。
type OrganizationGroupService struct {
	repo OrganizationGroupRepository
}

func NewOrganizationGroupService(repo OrganizationGroupRepository) *OrganizationGroupService {
	return &OrganizationGroupService{repo: repo}
}

// ApplyScopeToUser 把账号所属组织的分组范围和付款归属写进这份账号数据。
//
// 账号属于组织时，组织的范围整体接管：账号自己的授权清单和公开分组开关不再参与判断。
// 普通成员还会带上组织付款账号和自己的消费上限，供调用前的余额和额度判断使用。
// 账号不属于任何组织时原样返回，个人用户行为不变。
//
// 注意：调用方拿到的这份账号数据只用于权限判断和鉴权快照，不能再拿去回写账号，
// 否则会把组织范围写进账号自己的授权清单。
func (s *OrganizationGroupService) ApplyScopeToUser(ctx context.Context, user *User) error {
	if s == nil || s.repo == nil || user == nil || user.ID <= 0 {
		return nil
	}
	scope, err := s.repo.GetMemberScopeByUserID(ctx, user.ID)
	if err != nil {
		return err
	}
	if scope == nil {
		return nil
	}
	organizationID := scope.OrganizationID
	user.OrganizationID = &organizationID
	user.RestrictPublicGroups = scope.RestrictPublicGroups
	user.AllowedGroups = append([]int64(nil), scope.AllowedGroupIDs...)
	// 组织创建者花自己的钱，也不受成员消费上限约束。
	if scope.IsOwner {
		user.OrganizationPayerUserID = 0
		user.OrganizationSpendingLimit = nil
		return nil
	}
	user.OrganizationPayerUserID = scope.OwnerUserID
	user.OrganizationSpendingLimit = scope.SpendingLimit
	user.OrganizationPayerBalance = scope.OwnerBalance
	return nil
}

// MemberUserIDsOfOwnedOrganization 返回该账号作为创建者所拥有组织的全部成员。
//
// 组织付款账号的余额、状态变化会影响每个成员的鉴权快照，所以清缓存时要带上他们。
func (s *OrganizationGroupService) MemberUserIDsOfOwnedOrganization(ctx context.Context, ownerUserID int64) ([]int64, error) {
	if s == nil || s.repo == nil || ownerUserID <= 0 {
		return nil, nil
	}
	scope, err := s.repo.GetMemberScopeByUserID(ctx, ownerUserID)
	if err != nil || scope == nil || !scope.IsOwner {
		return nil, err
	}
	memberIDs, err := s.repo.ListMemberUserIDs(ctx, scope.OrganizationID)
	if err != nil {
		return nil, err
	}
	out := make([]int64, 0, len(memberIDs))
	for _, memberID := range memberIDs {
		if memberID != ownerUserID {
			out = append(out, memberID)
		}
	}
	return out, nil
}

// applyOrganizationGroupScope 是各调用点的统一入口。
//
// 解析失败时把错误抛回去，让这次请求直接失败：分组范围读不出来就宁可拒绝，
// 也不能回退到账号自己的规则，那会比组织范围更宽松。
func applyOrganizationGroupScope(ctx context.Context, resolver OrganizationGroupScopeResolver, user *User) error {
	if resolver == nil || user == nil {
		return nil
	}
	return resolver.ApplyScopeToUser(ctx, user)
}

// checkOrganizationGroupAccess 在调用前重新确认这次用的分组仍在组织范围内。
//
// 平台收回授权后，已经建好的密钥下一次调用就会被拒绝，不用等成员自己改密钥。
// 个人用户不进入这条分支，调用链行为保持原样。
func checkOrganizationGroupAccess(user *User, group *Group) error {
	if user == nil || user.OrganizationID == nil || group == nil {
		return nil
	}
	if user.CanBindGroup(group.ID, group.IsExclusive) {
		return nil
	}
	return ErrOrganizationGroupForbidden
}

func normalizeGroupIDs(groupIDs []int64) []int64 {
	seen := make(map[int64]struct{}, len(groupIDs))
	out := make([]int64, 0, len(groupIDs))
	for _, id := range groupIDs {
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}
