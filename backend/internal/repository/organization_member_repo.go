package repository

import (
	"context"
	"time"

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

// UpdateMemberDisplayName 修改一个成员在组织中的名称；成员不存在时返回稳定的业务错误。
func (r *organizationMemberRepository) UpdateMemberDisplayName(
	ctx context.Context,
	organizationID int64,
	userID int64,
	displayName string,
) error {
	affected, err := clientFromContext(ctx, r.client).OrganizationMember.Update().
		Where(
			organizationmember.OrganizationIDEQ(organizationID),
			organizationmember.UserIDEQ(userID),
		).
		SetDisplayName(displayName).
		Save(ctx)
	if err != nil {
		return err
	}
	if affected == 0 {
		return service.ErrOrganizationMemberNotFound
	}
	return nil
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
		// 三种配额模式互斥：写静态上限同时清掉周期配额配置与当期一次性加成。
		update = update.
			ClearQuotaAmount().
			ClearQuotaPeriodDays().
			ClearQuotaStartAt().
			ClearQuotaCycleStart().
			SetQuotaCycleBonus(0)
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

// SetPeriodicQuotas 在一个事务里写入多个成员的周期配额，全部成功或全部不生效。
func (r *organizationMemberRepository) SetPeriodicQuotas(
	ctx context.Context,
	organizationID int64,
	writes []service.OrganizationMemberQuotaWrite,
) error {
	if len(writes) == 0 {
		return nil
	}

	apply := func(ctx context.Context, client *dbent.Client) error {
		for _, write := range writes {
			update := client.OrganizationMember.Update().
				Where(
					organizationmember.OrganizationIDEQ(organizationID),
					organizationmember.UserIDEQ(write.UserID),
				)
			if write.Quota == nil {
				// 取消周期：四个周期列清空，已消费与静态上限不动，当期加成作废。
				update = update.
					ClearQuotaAmount().
					ClearQuotaPeriodDays().
					ClearQuotaStartAt().
					ClearQuotaCycleStart().
					SetQuotaCycleBonus(0)
			} else {
				// 换一套周期配置等于换一期：上一期的一次性加成不带过来。
				update = update.
					SetQuotaAmount(write.Quota.Amount).
					SetQuotaPeriodDays(write.Quota.PeriodDays).
					SetQuotaStartAt(write.Quota.StartAt).
					SetQuotaCycleBonus(0)
				if write.CycleStart != nil {
					update = update.SetQuotaCycleStart(*write.CycleStart)
				} else {
					update = update.ClearQuotaCycleStart()
				}
				if write.ResetUsed {
					// 第一期开始，当期已消费清零；静态累计口径被周期口径接管。
					update = update.SetSpendingUsed(0)
				}
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

	// 调用方已经开了事务时复用它，否则自己开一个，保证整批一起生效。
	if outer := dbent.TxFromContext(ctx); outer != nil {
		return apply(ctx, outer.Client())
	}

	tx, err := r.client.Tx(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if err := apply(ctx, tx.Client()); err != nil {
		return err
	}
	return tx.Commit()
}

// AdvanceDueQuota 在行锁里把到期未推进的成员行推进到当前期：
// 当期起点对齐、当期已消费清零。冻结金额不清——它是真实占用的钱，
// 带进新期继续占新期的额度。无需推进时返回 nil。
func (r *organizationMemberRepository) AdvanceDueQuota(
	ctx context.Context,
	userID int64,
	now time.Time,
) (*service.OrganizationMember, error) {
	tx, err := r.client.Tx(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	row, err := advanceDueOrganizationQuotaRow(ctx, tx.Client(), userID, now)
	if err != nil || row == nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return row, nil
}

// advanceDueOrganizationQuotaRow 是推进的执行体，在传入的客户端（通常是事务）
// 上先 FOR UPDATE 锁行再判断，避免与扣费、预扣并发时丢更新。
// 行不存在或无需推进时返回 nil。
func advanceDueOrganizationQuotaRow(
	ctx context.Context,
	client *dbent.Client,
	userID int64,
	now time.Time,
) (*service.OrganizationMember, error) {
	entity, err := client.OrganizationMember.Query().
		Where(organizationmember.UserIDEQ(userID)).
		ForUpdate().
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}

	state := service.ResolveMemberQuotaState(
		entity.QuotaAmount, entity.QuotaPeriodDays, entity.QuotaStartAt, entity.QuotaCycleStart, now,
	)
	if !state.NeedsAdvance || state.CycleStart == nil {
		return nil, nil
	}

	updated, err := client.OrganizationMember.UpdateOne(entity).
		SetQuotaCycleStart(*state.CycleStart).
		SetSpendingUsed(0).
		SetQuotaCycleBonus(0).
		Save(ctx)
	if err != nil {
		return nil, err
	}

	// 返回一个只带推进结果的最小成员对象，调用方按需覆盖内存里的行。
	result := &service.OrganizationMember{
		UserID:          updated.UserID,
		QuotaCycleStart: state.CycleStart,
		SpendingUsed:    updated.SpendingUsed,
		QuotaCycleBonus: updated.QuotaCycleBonus,
	}
	return result, nil
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

// GetMemberSpending 返回成员已消费金额加已冻结金额，以及周期配额的本期截止时间。
// 不是组织成员时返回 0。周期到期时先在行锁内推进再读，保证建进缓存的数字
// 属于当前期；windowEnd 供缓存层把 TTL 截到本期截止。
func (r *organizationMemberRepository) GetMemberSpending(ctx context.Context, userID int64) (float64, *time.Time, error) {
	tx, err := r.client.Tx(ctx)
	if err != nil {
		return 0, nil, err
	}
	defer func() { _ = tx.Rollback() }()

	client := tx.Client()
	entity, err := client.OrganizationMember.Query().
		Where(organizationmember.UserIDEQ(userID)).
		ForUpdate().
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return 0, nil, nil
		}
		return 0, nil, err
	}

	state := service.ResolveMemberQuotaState(
		entity.QuotaAmount, entity.QuotaPeriodDays, entity.QuotaStartAt, entity.QuotaCycleStart, time.Now(),
	)
	if state.NeedsAdvance && state.CycleStart != nil {
		entity, err = client.OrganizationMember.UpdateOne(entity).
			SetQuotaCycleStart(*state.CycleStart).
			SetSpendingUsed(0).
			SetQuotaCycleBonus(0).
			Save(ctx)
		if err != nil {
			return 0, nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return 0, nil, err
	}
	return entity.SpendingUsed + entity.SpendingFrozen, state.WindowEnd, nil
}

func organizationMemberEntityToService(entity *dbent.OrganizationMember, ownerUserID int64) *service.OrganizationMember {
	if entity == nil || entity.Edges.User == nil {
		return nil
	}
	user := entity.Edges.User
	return &service.OrganizationMember{
		OrganizationID:  entity.OrganizationID,
		UserID:          entity.UserID,
		Email:           user.Email,
		Username:        user.Username,
		DisplayName:     entity.DisplayName,
		Status:          user.Status,
		Role:            user.Role,
		IsOwner:         entity.UserID == ownerUserID,
		SpendingLimit:   entity.SpendingLimit,
		SpendingUsed:    entity.SpendingUsed,
		SpendingFrozen:  entity.SpendingFrozen,
		QuotaAmount:     entity.QuotaAmount,
		QuotaPeriodDays: entity.QuotaPeriodDays,
		QuotaStartAt:    entity.QuotaStartAt,
		QuotaCycleStart: entity.QuotaCycleStart,
		QuotaCycleBonus: entity.QuotaCycleBonus,
		JoinedAt:        entity.CreatedAt,
	}
}

var (
	_ service.OrganizationMemberRepository   = (*organizationMemberRepository)(nil)
	_ service.OrganizationSpendingRepository = (*organizationMemberRepository)(nil)
)
