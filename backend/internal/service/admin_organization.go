package service

import (
	"context"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/logger"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
)

// AdminOrganization 是平台「组织管理」页看到的一个组织。
type AdminOrganization struct {
	ID                   int64
	Name                 string
	OwnerUserID          int64
	OwnerEmail           string
	OwnerUsername        string
	MemberCount          int
	Status               string
	RestrictPublicGroups bool
	AllowedGroupIDs      []int64
	CreatedAt            time.Time
}

// AdminOrganizationListFilters 限定组织列表的查询条件。
type AdminOrganizationListFilters struct {
	Search string
}

type AdminOrganizationRepository interface {
	List(
		ctx context.Context,
		params pagination.PaginationParams,
		filters AdminOrganizationListFilters,
	) ([]AdminOrganization, *pagination.PaginationResult, error)
	Get(ctx context.Context, organizationID int64) (*AdminOrganization, error)
}

// AdminOrganizationService 提供平台管理员对全平台组织的查看和分组授权。
// 组织管理员和普通成员没有这里的任何权限。
type AdminOrganizationService struct {
	organizations AdminOrganizationRepository
	groups        OrganizationGroupRepository
	groupRepo     GroupRepository
	authCache     APIKeyAuthCacheInvalidator
}

func NewAdminOrganizationService(
	organizations AdminOrganizationRepository,
	groups OrganizationGroupRepository,
	groupRepo GroupRepository,
	authCache APIKeyAuthCacheInvalidator,
) *AdminOrganizationService {
	return &AdminOrganizationService{
		organizations: organizations,
		groups:        groups,
		groupRepo:     groupRepo,
		authCache:     authCache,
	}
}

func (s *AdminOrganizationService) List(
	ctx context.Context,
	params pagination.PaginationParams,
	filters AdminOrganizationListFilters,
) ([]AdminOrganization, *pagination.PaginationResult, error) {
	if s == nil || s.organizations == nil {
		return nil, nil, ErrServiceUnavailable
	}
	filters.Search = strings.TrimSpace(filters.Search)
	return s.organizations.List(ctx, params, filters)
}

func (s *AdminOrganizationService) Get(ctx context.Context, organizationID int64) (*AdminOrganization, error) {
	if s == nil || s.organizations == nil {
		return nil, ErrServiceUnavailable
	}
	if organizationID <= 0 {
		return nil, ErrOrganizationNotFound
	}
	return s.organizations.Get(ctx, organizationID)
}

// UpdateGroups 覆盖写入一个组织的分组范围，并立即清理该组织全部成员的鉴权缓存，
// 否则收回的授权要等一个缓存周期才会生效。
func (s *AdminOrganizationService) UpdateGroups(
	ctx context.Context,
	organizationID int64,
	restrictPublicGroups bool,
	groupIDs []int64,
) (*AdminOrganization, error) {
	if s == nil || s.organizations == nil || s.groups == nil {
		return nil, ErrServiceUnavailable
	}
	if organizationID <= 0 {
		return nil, ErrOrganizationNotFound
	}
	if _, err := s.organizations.Get(ctx, organizationID); err != nil {
		return nil, err
	}

	normalized := normalizeGroupIDs(groupIDs)
	if err := s.ensureGroupsExist(ctx, normalized); err != nil {
		return nil, err
	}
	if err := s.groups.SetScope(ctx, organizationID, restrictPublicGroups, normalized); err != nil {
		return nil, err
	}
	s.invalidateMembers(ctx, organizationID)

	return s.organizations.Get(ctx, organizationID)
}

// UpdateStatus 启用或停用整个组织。
//
// 只改组织这一层，成员账号的状态一个字不动：恢复组织后，原本被单独停用的成员
// 仍然是停用的。改完立刻清掉全体成员的鉴权缓存，停用当场生效。
func (s *AdminOrganizationService) UpdateStatus(
	ctx context.Context,
	organizationID int64,
	status string,
) (*AdminOrganization, error) {
	if s == nil || s.organizations == nil || s.groups == nil {
		return nil, ErrServiceUnavailable
	}
	if organizationID <= 0 {
		return nil, ErrOrganizationNotFound
	}
	status = strings.TrimSpace(status)
	if status != StatusActive && status != StatusDisabled {
		return nil, ErrOrganizationStatusInvalid
	}
	if _, err := s.organizations.Get(ctx, organizationID); err != nil {
		return nil, err
	}
	if err := s.groups.SetStatus(ctx, organizationID, status); err != nil {
		return nil, err
	}
	s.invalidateMembers(ctx, organizationID)
	return s.organizations.Get(ctx, organizationID)
}

// ensureGroupsExist 拒绝不存在的分组，避免把无效授权写进库里。
func (s *AdminOrganizationService) ensureGroupsExist(ctx context.Context, groupIDs []int64) error {
	if len(groupIDs) == 0 || s.groupRepo == nil {
		return nil
	}
	for _, groupID := range groupIDs {
		if _, err := s.groupRepo.GetByID(ctx, groupID); err != nil {
			return ErrOrganizationGroupInvalid
		}
	}
	return nil
}

func (s *AdminOrganizationService) invalidateMembers(ctx context.Context, organizationID int64) {
	if s.authCache == nil {
		return
	}
	memberIDs, err := s.groups.ListMemberUserIDs(ctx, organizationID)
	if err != nil {
		logger.LegacyPrintf("service.admin_organization",
			"ALERT: list organization members for cache invalidation failed: organization_id=%d err=%v",
			organizationID, err)
		return
	}
	for _, userID := range memberIDs {
		s.authCache.InvalidateAuthCacheByUserID(ctx, userID)
	}
}
