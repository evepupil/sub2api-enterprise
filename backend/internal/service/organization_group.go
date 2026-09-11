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

// OrganizationGroupScope 是平台授予某个组织的分组范围。
//
// 判断规则与账号侧完全一致：
//
//	RestrictPublicGroups = false → 公开分组全部可用，专属分组只认 AllowedGroupIDs
//	RestrictPublicGroups = true  → 公开分组也必须落在 AllowedGroupIDs 里
//
// 新建组织没有任何授权记录，落到的就是「公开分组全放、专属分组全不给」。
type OrganizationGroupScope struct {
	OrganizationID       int64
	RestrictPublicGroups bool
	AllowedGroupIDs      []int64
}

type OrganizationGroupRepository interface {
	// GetScopeByUserID 返回该账号所属组织的分组范围；账号不属于任何组织时返回 nil。
	GetScopeByUserID(ctx context.Context, userID int64) (*OrganizationGroupScope, error)
	GetScopeByOrganizationID(ctx context.Context, organizationID int64) (*OrganizationGroupScope, error)
	// SetScope 覆盖写入组织的分组范围，开关和分组清单一起生效。
	SetScope(ctx context.Context, organizationID int64, restrictPublicGroups bool, groupIDs []int64) error
	ListMemberUserIDs(ctx context.Context, organizationID int64) ([]int64, error)
}

// OrganizationGroupScopeResolver 把组织的分组范围套到账号上，供密钥服务和鉴权快照使用。
type OrganizationGroupScopeResolver interface {
	ApplyScopeToUser(ctx context.Context, user *User) error
}

// OrganizationGroupService 负责组织分组范围的读取与套用。
// 平台侧的组织管理接口在 admin_organization.go。
type OrganizationGroupService struct {
	repo OrganizationGroupRepository
}

func NewOrganizationGroupService(repo OrganizationGroupRepository) *OrganizationGroupService {
	return &OrganizationGroupService{repo: repo}
}

// ApplyScopeToUser 把账号所属组织的分组范围写进这份账号数据。
//
// 账号属于组织时，组织的范围整体接管：账号自己的授权清单和公开分组开关不再参与判断。
// 账号不属于任何组织时原样返回，个人用户行为不变。
//
// 注意：调用方拿到的这份账号数据只用于分组判断和鉴权快照，不能再拿去回写账号，
// 否则会把组织范围写进账号自己的授权清单。
func (s *OrganizationGroupService) ApplyScopeToUser(ctx context.Context, user *User) error {
	if s == nil || s.repo == nil || user == nil || user.ID <= 0 {
		return nil
	}
	scope, err := s.repo.GetScopeByUserID(ctx, user.ID)
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
	return nil
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
