package repository

import (
	"context"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/organization"
	"github.com/Wei-Shaw/sub2api/ent/organizationmember"
	"github.com/Wei-Shaw/sub2api/ent/predicate"
	dbuser "github.com/Wei-Shaw/sub2api/ent/user"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

type organizationMemberRepository struct {
	client *dbent.Client
}

func NewOrganizationMemberRepository(client *dbent.Client) service.OrganizationMemberRepository {
	return &organizationMemberRepository{client: client}
}

// memberUserPredicates 组装成员所属账号需要满足的条件。
//
// SoftDeleteMixin 的拦截器不会下沉到 HasUserWith 子查询，必须显式加
// DeletedAtIsNil()，否则已删除账号会出现在成员列表里。
func memberUserPredicates(filters service.OrganizationMemberListFilters) []predicate.User {
	predicates := []predicate.User{dbuser.DeletedAtIsNil()}
	if filters.Status != "" {
		predicates = append(predicates, dbuser.StatusEQ(filters.Status))
	}
	if filters.Search != "" {
		predicates = append(predicates, dbuser.Or(
			dbuser.EmailContainsFold(filters.Search),
			dbuser.UsernameContainsFold(filters.Search),
		))
	}
	return predicates
}

func (r *organizationMemberRepository) ownerUserID(ctx context.Context, organizationID int64) (int64, error) {
	owner, err := clientFromContext(ctx, r.client).Organization.Query().
		Where(organization.IDEQ(organizationID)).
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return 0, service.ErrOrganizationNotFound
		}
		return 0, err
	}
	return owner.OwnerUserID, nil
}

func (r *organizationMemberRepository) List(
	ctx context.Context,
	organizationID int64,
	params pagination.PaginationParams,
	filters service.OrganizationMemberListFilters,
) ([]service.OrganizationMember, *pagination.PaginationResult, error) {
	ownerUserID, err := r.ownerUserID(ctx, organizationID)
	if err != nil {
		return nil, nil, err
	}

	query := clientFromContext(ctx, r.client).OrganizationMember.Query().
		Where(
			organizationmember.OrganizationIDEQ(organizationID),
			organizationmember.HasUserWith(memberUserPredicates(filters)...),
		)

	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, nil, err
	}

	members := make([]service.OrganizationMember, 0)
	if total == 0 {
		return members, paginationResultFromTotal(int64(total), params), nil
	}

	entities, err := query.
		WithUser().
		Order(
			dbent.Desc(organizationmember.FieldCreatedAt),
			dbent.Desc(organizationmember.FieldID),
		).
		Offset(params.Offset()).
		Limit(params.Limit()).
		All(ctx)
	if err != nil {
		return nil, nil, err
	}
	for _, entity := range entities {
		member := organizationMemberEntityToService(entity, ownerUserID)
		if member == nil {
			continue
		}
		members = append(members, *member)
	}
	return members, paginationResultFromTotal(int64(total), params), nil
}

func (r *organizationMemberRepository) Get(
	ctx context.Context,
	organizationID int64,
	userID int64,
) (*service.OrganizationMember, error) {
	ownerUserID, err := r.ownerUserID(ctx, organizationID)
	if err != nil {
		return nil, err
	}

	entity, err := clientFromContext(ctx, r.client).OrganizationMember.Query().
		Where(
			organizationmember.OrganizationIDEQ(organizationID),
			organizationmember.UserIDEQ(userID),
			organizationmember.HasUserWith(dbuser.DeletedAtIsNil()),
		).
		WithUser().
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return nil, service.ErrOrganizationMemberNotFound
		}
		return nil, err
	}
	member := organizationMemberEntityToService(entity, ownerUserID)
	if member == nil {
		return nil, service.ErrOrganizationMemberNotFound
	}
	return member, nil
}

func (r *organizationMemberRepository) SetSpendingLimits(
	ctx context.Context,
	organizationID int64,
	limits []service.OrganizationMemberSpendingLimit,
) error {
	if len(limits) == 0 {
		return nil
	}

	// 调用方已经开了事务时复用它，否则自己开一个，保证整批上限一起生效。
	if outer := dbent.TxFromContext(ctx); outer != nil {
		return applyOrganizationSpendingLimits(ctx, outer.Client(), organizationID, limits)
	}

	tx, err := r.client.Tx(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if err := applyOrganizationSpendingLimits(ctx, tx.Client(), organizationID, limits); err != nil {
		return err
	}
	return tx.Commit()
}

func applyOrganizationSpendingLimits(
	ctx context.Context,
	client *dbent.Client,
	organizationID int64,
	limits []service.OrganizationMemberSpendingLimit,
) error {
	for _, limit := range limits {
		update := client.OrganizationMember.Update().
			Where(
				organizationmember.OrganizationIDEQ(organizationID),
				organizationmember.UserIDEQ(limit.UserID),
			)
		if limit.Limit == nil {
			update = update.ClearSpendingLimit()
		} else {
			update = update.SetSpendingLimit(*limit.Limit)
		}
		affected, err := update.Save(ctx)
		if err != nil {
			return err
		}
		if affected == 0 {
			return service.ErrOrganizationMemberNotFound
		}
	}
	return nil
}

// ListUserIDs 返回组织全部成员的账号标识，含组织创建者本人。
// 停用的成员同样在内，他们的历史用量仍然算组织的。
func (r *organizationMemberRepository) ListUserIDs(ctx context.Context, organizationID int64) ([]int64, error) {
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

// NewOrganizationSpendingRepository 暴露成员已占用额度的读取，供计费缓存回源使用。
func NewOrganizationSpendingRepository(client *dbent.Client) service.OrganizationSpendingRepository {
	return &organizationMemberRepository{client: client}
}

// GetMemberSpending 返回成员已消费金额加已冻结金额；不是组织成员时返回 0。
func (r *organizationMemberRepository) GetMemberSpending(ctx context.Context, userID int64) (float64, error) {
	entity, err := clientFromContext(ctx, r.client).OrganizationMember.Query().
		Where(organizationmember.UserIDEQ(userID)).
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return 0, nil
		}
		return 0, err
	}
	return entity.SpendingUsed + entity.SpendingFrozen, nil
}

func organizationMemberEntityToService(entity *dbent.OrganizationMember, ownerUserID int64) *service.OrganizationMember {
	if entity == nil || entity.Edges.User == nil {
		return nil
	}
	user := entity.Edges.User
	return &service.OrganizationMember{
		UserID:         entity.UserID,
		Email:          user.Email,
		Username:       user.Username,
		Status:         user.Status,
		Role:           user.Role,
		IsOwner:        entity.UserID == ownerUserID,
		SpendingLimit:  entity.SpendingLimit,
		SpendingUsed:   entity.SpendingUsed,
		SpendingFrozen: entity.SpendingFrozen,
		JoinedAt:       entity.CreatedAt,
	}
}

var (
	_ service.OrganizationMemberRepository   = (*organizationMemberRepository)(nil)
	_ service.OrganizationSpendingRepository = (*organizationMemberRepository)(nil)
)
