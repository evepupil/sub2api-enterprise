package repository

import (
	"context"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/organization"
	"github.com/Wei-Shaw/sub2api/ent/organizationallowedgroup"
	"github.com/Wei-Shaw/sub2api/ent/organizationmember"
	dbuser "github.com/Wei-Shaw/sub2api/ent/user"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

type organizationGroupRepository struct {
	client *dbent.Client
}

func NewOrganizationGroupRepository(client *dbent.Client) service.OrganizationGroupRepository {
	return &organizationGroupRepository{client: client}
}

func (r *organizationGroupRepository) GetScopeByUserID(
	ctx context.Context,
	userID int64,
) (*service.OrganizationGroupScope, error) {
	client := clientFromContext(ctx, r.client)
	membership, err := client.OrganizationMember.Query().
		Where(organizationmember.UserIDEQ(userID)).
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			// 个人用户没有组织归属，沿用账号自己的分组规则。
			return nil, nil
		}
		return nil, err
	}
	return r.GetScopeByOrganizationID(ctx, membership.OrganizationID)
}

func (r *organizationGroupRepository) GetScopeByOrganizationID(
	ctx context.Context,
	organizationID int64,
) (*service.OrganizationGroupScope, error) {
	client := clientFromContext(ctx, r.client)
	entity, err := client.Organization.Query().
		Where(organization.IDEQ(organizationID)).
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return nil, service.ErrOrganizationNotFound
		}
		return nil, err
	}
	groupIDs, err := r.listAllowedGroupIDs(ctx, organizationID)
	if err != nil {
		return nil, err
	}
	return &service.OrganizationGroupScope{
		OrganizationID:       entity.ID,
		RestrictPublicGroups: entity.RestrictPublicGroups,
		AllowedGroupIDs:      groupIDs,
	}, nil
}

func (r *organizationGroupRepository) listAllowedGroupIDs(ctx context.Context, organizationID int64) ([]int64, error) {
	rows, err := clientFromContext(ctx, r.client).OrganizationAllowedGroup.Query().
		Where(organizationallowedgroup.OrganizationIDEQ(organizationID)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	groupIDs := make([]int64, 0, len(rows))
	for _, row := range rows {
		groupIDs = append(groupIDs, row.GroupID)
	}
	return groupIDs, nil
}

// SetScope 在一个事务里覆盖写入开关和授权清单，避免出现「开关已收紧但清单还没写入」的中间状态。
func (r *organizationGroupRepository) SetScope(
	ctx context.Context,
	organizationID int64,
	restrictPublicGroups bool,
	groupIDs []int64,
) error {
	if outer := dbent.TxFromContext(ctx); outer != nil {
		return applyOrganizationGroupScope(ctx, outer.Client(), organizationID, restrictPublicGroups, groupIDs)
	}

	tx, err := r.client.Tx(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if err := applyOrganizationGroupScope(ctx, tx.Client(), organizationID, restrictPublicGroups, groupIDs); err != nil {
		return err
	}
	return tx.Commit()
}

func applyOrganizationGroupScope(
	ctx context.Context,
	client *dbent.Client,
	organizationID int64,
	restrictPublicGroups bool,
	groupIDs []int64,
) error {
	affected, err := client.Organization.Update().
		Where(organization.IDEQ(organizationID)).
		SetRestrictPublicGroups(restrictPublicGroups).
		Save(ctx)
	if err != nil {
		return err
	}
	if affected == 0 {
		return service.ErrOrganizationNotFound
	}

	if _, err := client.OrganizationAllowedGroup.Delete().
		Where(organizationallowedgroup.OrganizationIDEQ(organizationID)).
		Exec(ctx); err != nil {
		return err
	}
	if len(groupIDs) == 0 {
		return nil
	}

	builders := make([]*dbent.OrganizationAllowedGroupCreate, 0, len(groupIDs))
	for _, groupID := range groupIDs {
		builders = append(builders, client.OrganizationAllowedGroup.Create().
			SetOrganizationID(organizationID).
			SetGroupID(groupID))
	}
	_, err = client.OrganizationAllowedGroup.CreateBulk(builders...).Save(ctx)
	return err
}

func (r *organizationGroupRepository) ListMemberUserIDs(ctx context.Context, organizationID int64) ([]int64, error) {
	rows, err := clientFromContext(ctx, r.client).OrganizationMember.Query().
		Where(organizationmember.OrganizationIDEQ(organizationID)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	userIDs := make([]int64, 0, len(rows))
	for _, row := range rows {
		userIDs = append(userIDs, row.UserID)
	}
	return userIDs, nil
}

type adminOrganizationRepository struct {
	client *dbent.Client
}

func NewAdminOrganizationRepository(client *dbent.Client) service.AdminOrganizationRepository {
	return &adminOrganizationRepository{client: client}
}

func (r *adminOrganizationRepository) List(
	ctx context.Context,
	params pagination.PaginationParams,
	filters service.AdminOrganizationListFilters,
) ([]service.AdminOrganization, *pagination.PaginationResult, error) {
	client := clientFromContext(ctx, r.client)
	query := client.Organization.Query()
	if filters.Search != "" {
		query = query.Where(organization.Or(
			organization.NameContainsFold(filters.Search),
			organization.HasOwnerWith(
				dbuser.DeletedAtIsNil(),
				dbuser.Or(
					dbuser.EmailContainsFold(filters.Search),
					dbuser.UsernameContainsFold(filters.Search),
				),
			),
		))
	}

	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, nil, err
	}
	organizations := make([]service.AdminOrganization, 0)
	if total == 0 {
		return organizations, paginationResultFromTotal(int64(total), params), nil
	}

	entities, err := query.
		WithOwner().
		Order(dbent.Desc(organization.FieldCreatedAt), dbent.Desc(organization.FieldID)).
		Offset(params.Offset()).
		Limit(params.Limit()).
		All(ctx)
	if err != nil {
		return nil, nil, err
	}

	organizationIDs := make([]int64, 0, len(entities))
	for _, entity := range entities {
		organizationIDs = append(organizationIDs, entity.ID)
	}
	memberCounts, err := r.memberCounts(ctx, organizationIDs)
	if err != nil {
		return nil, nil, err
	}
	allowedGroups, err := r.allowedGroups(ctx, organizationIDs)
	if err != nil {
		return nil, nil, err
	}

	for _, entity := range entities {
		organizations = append(organizations, *adminOrganizationFromEntity(
			entity,
			memberCounts[entity.ID],
			allowedGroups[entity.ID],
		))
	}
	return organizations, paginationResultFromTotal(int64(total), params), nil
}

func (r *adminOrganizationRepository) Get(
	ctx context.Context,
	organizationID int64,
) (*service.AdminOrganization, error) {
	entity, err := clientFromContext(ctx, r.client).Organization.Query().
		Where(organization.IDEQ(organizationID)).
		WithOwner().
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return nil, service.ErrOrganizationNotFound
		}
		return nil, err
	}
	memberCounts, err := r.memberCounts(ctx, []int64{organizationID})
	if err != nil {
		return nil, err
	}
	allowedGroups, err := r.allowedGroups(ctx, []int64{organizationID})
	if err != nil {
		return nil, err
	}
	return adminOrganizationFromEntity(entity, memberCounts[organizationID], allowedGroups[organizationID]), nil
}

// memberCounts 一次查出多个组织的成员数，避免逐个组织查询。
func (r *adminOrganizationRepository) memberCounts(ctx context.Context, organizationIDs []int64) (map[int64]int, error) {
	counts := make(map[int64]int, len(organizationIDs))
	if len(organizationIDs) == 0 {
		return counts, nil
	}
	rows, err := clientFromContext(ctx, r.client).OrganizationMember.Query().
		Where(organizationmember.OrganizationIDIn(organizationIDs...)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		counts[row.OrganizationID]++
	}
	return counts, nil
}

func (r *adminOrganizationRepository) allowedGroups(ctx context.Context, organizationIDs []int64) (map[int64][]int64, error) {
	grouped := make(map[int64][]int64, len(organizationIDs))
	if len(organizationIDs) == 0 {
		return grouped, nil
	}
	rows, err := clientFromContext(ctx, r.client).OrganizationAllowedGroup.Query().
		Where(organizationallowedgroup.OrganizationIDIn(organizationIDs...)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		grouped[row.OrganizationID] = append(grouped[row.OrganizationID], row.GroupID)
	}
	return grouped, nil
}

func adminOrganizationFromEntity(
	entity *dbent.Organization,
	memberCount int,
	allowedGroupIDs []int64,
) *service.AdminOrganization {
	if entity == nil {
		return nil
	}
	result := &service.AdminOrganization{
		ID:                   entity.ID,
		Name:                 entity.Name,
		OwnerUserID:          entity.OwnerUserID,
		MemberCount:          memberCount,
		RestrictPublicGroups: entity.RestrictPublicGroups,
		AllowedGroupIDs:      allowedGroupIDs,
		CreatedAt:            entity.CreatedAt,
	}
	if result.AllowedGroupIDs == nil {
		result.AllowedGroupIDs = []int64{}
	}
	if entity.Edges.Owner != nil {
		result.OwnerEmail = entity.Edges.Owner.Email
		result.OwnerUsername = entity.Edges.Owner.Username
	}
	return result
}

var (
	_ service.OrganizationGroupRepository = (*organizationGroupRepository)(nil)
	_ service.AdminOrganizationRepository = (*adminOrganizationRepository)(nil)
)
