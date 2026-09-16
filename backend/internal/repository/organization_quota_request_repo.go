package repository

import (
	"context"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/organization"
	"github.com/Wei-Shaw/sub2api/ent/organizationmember"
	"github.com/Wei-Shaw/sub2api/ent/organizationquotarequest"
	"github.com/Wei-Shaw/sub2api/ent/predicate"
	dbuser "github.com/Wei-Shaw/sub2api/ent/user"
	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

type organizationQuotaRequestRepository struct {
	client *dbent.Client
}

// NewOrganizationQuotaRequestRepository 暴露配额申请流水与组织申请策略的读写。
func NewOrganizationQuotaRequestRepository(client *dbent.Client) service.OrganizationQuotaRequestRepository {
	return &organizationQuotaRequestRepository{client: client}
}

func (r *organizationQuotaRequestRepository) GetPolicy(
	ctx context.Context,
	organizationID int64,
) (*service.OrganizationQuotaRequestPolicy, error) {
	entity, err := clientFromContext(ctx, r.client).Organization.Query().
		Where(organization.IDEQ(organizationID)).
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return nil, service.ErrOrganizationNotFound
		}
		return nil, err
	}
	return &service.OrganizationQuotaRequestPolicy{
		Mode: entity.QuotaRequestMode,
		Min:  entity.QuotaRequestMin,
		Max:  entity.QuotaRequestMax,
	}, nil
}

func (r *organizationQuotaRequestRepository) UpdatePolicy(
	ctx context.Context,
	organizationID int64,
	policy service.OrganizationQuotaRequestPolicy,
) error {
	update := clientFromContext(ctx, r.client).Organization.Update().
		Where(organization.IDEQ(organizationID)).
		SetQuotaRequestMode(policy.Mode)
	if policy.Min == nil {
		update = update.ClearQuotaRequestMin()
	} else {
		update = update.SetQuotaRequestMin(*policy.Min)
	}
	if policy.Max == nil {
		update = update.ClearQuotaRequestMax()
	} else {
		update = update.SetQuotaRequestMax(*policy.Max)
	}
	affected, err := update.Save(ctx)
	if err != nil {
		return err
	}
	if affected == 0 {
		return service.ErrOrganizationNotFound
	}
	return nil
}

func (r *organizationQuotaRequestRepository) Create(
	ctx context.Context,
	request *service.OrganizationQuotaRequest,
) error {
	create := clientFromContext(ctx, r.client).OrganizationQuotaRequest.Create().
		SetOrganizationID(request.OrganizationID).
		SetUserID(request.UserID).
		SetAmount(request.Amount).
		SetReason(request.Reason).
		SetStatus(request.Status).
		SetSnapshotMode(request.SnapshotMode).
		SetSnapshotUsed(request.SnapshotUsed)
	if request.SnapshotLimit != nil {
		create = create.SetSnapshotLimit(*request.SnapshotLimit)
	}
	created, err := create.Save(ctx)
	if err != nil {
		return err
	}
	applyQuotaRequestEntity(request, created)
	return nil
}

// CreateAutoGranted 即申即加：同一事务里写已发放流水并把金额加到成员身上。
// 成员行先 FOR UPDATE 锁住再判断，发放与流水要么都成、要么都不成。
func (r *organizationQuotaRequestRepository) CreateAutoGranted(
	ctx context.Context,
	request *service.OrganizationQuotaRequest,
	member *service.OrganizationMember,
) error {
	tx, err := r.client.Tx(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	client := tx.Client()
	if err := applyTopUpToMember(ctx, client, member, request.Amount); err != nil {
		return err
	}

	create := client.OrganizationQuotaRequest.Create().
		SetOrganizationID(request.OrganizationID).
		SetUserID(request.UserID).
		SetAmount(request.Amount).
		SetReason(request.Reason).
		SetStatus(request.Status).
		SetGrantSource(service.QuotaRequestSourceAuto).
		SetGrantedAmount(*request.GrantedAmount).
		SetSnapshotMode(request.SnapshotMode).
		SetSnapshotUsed(request.SnapshotUsed)
	if request.SnapshotLimit != nil {
		create = create.SetSnapshotLimit(*request.SnapshotLimit)
	}
	created, err := create.Save(ctx)
	if err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	applyQuotaRequestEntity(request, created)
	return nil
}

func (r *organizationQuotaRequestRepository) Get(
	ctx context.Context,
	organizationID int64,
	requestID int64,
) (*service.OrganizationQuotaRequest, error) {
	entity, err := clientFromContext(ctx, r.client).OrganizationQuotaRequest.Query().
		Where(
			organizationquotarequest.IDEQ(requestID),
			organizationquotarequest.OrganizationIDEQ(organizationID),
		).
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return nil, service.ErrOrganizationQuotaRequestNotFound
		}
		return nil, err
	}
	request := quotaRequestEntityToService(entity)
	return &request, nil
}

func (r *organizationQuotaRequestRepository) ListByOrganization(
	ctx context.Context,
	organizationID int64,
	params pagination.PaginationParams,
	filters service.OrganizationQuotaRequestListFilters,
) ([]service.OrganizationQuotaRequest, *pagination.PaginationResult, error) {
	predicates := []predicate.OrganizationQuotaRequest{organizationquotarequest.OrganizationIDEQ(organizationID)}
	if filters.Status != "" {
		predicates = append(predicates, organizationquotarequest.StatusEQ(filters.Status))
	}
	return r.list(ctx, predicates, params)
}

func (r *organizationQuotaRequestRepository) ListByUser(
	ctx context.Context,
	userID int64,
	params pagination.PaginationParams,
	filters service.OrganizationQuotaRequestListFilters,
) ([]service.OrganizationQuotaRequest, *pagination.PaginationResult, error) {
	predicates := []predicate.OrganizationQuotaRequest{organizationquotarequest.UserIDEQ(userID)}
	if filters.Status != "" {
		predicates = append(predicates, organizationquotarequest.StatusEQ(filters.Status))
	}
	return r.list(ctx, predicates, params)
}

// list 按条件倒序分页，并补齐申请人的邮箱与用户名（管理员列表展示用）。
func (r *organizationQuotaRequestRepository) list(
	ctx context.Context,
	predicates []predicate.OrganizationQuotaRequest,
	params pagination.PaginationParams,
) ([]service.OrganizationQuotaRequest, *pagination.PaginationResult, error) {
	client := clientFromContext(ctx, r.client)
	query := client.OrganizationQuotaRequest.Query().Where(predicates...)

	total, err := query.Clone().Count(ctx)
	if err != nil {
		return nil, nil, err
	}
	requests := make([]service.OrganizationQuotaRequest, 0)
	if total == 0 {
		return requests, paginationResultFromTotal(int64(total), params), nil
	}

	entities, err := query.
		Order(
			dbent.Desc(organizationquotarequest.FieldCreatedAt),
			dbent.Desc(organizationquotarequest.FieldID),
		).
		Offset(params.Offset()).
		Limit(params.Limit()).
		All(ctx)
	if err != nil {
		return nil, nil, err
	}

	userIDs := make([]int64, 0, len(entities))
	for _, entity := range entities {
		userIDs = append(userIDs, entity.UserID)
	}
	// 流水是归档：申请人账号即使后来被软删除，列表仍要能认出是谁。
	users, err := client.User.Query().Where(dbuser.IDIn(userIDs...)).All(ctx)
	if err != nil {
		return nil, nil, err
	}
	emails := make(map[int64]service.OrganizationMember, len(users))
	for _, user := range users {
		emails[user.ID] = service.OrganizationMember{Email: user.Email, Username: user.Username}
	}

	for _, entity := range entities {
		request := quotaRequestEntityToService(entity)
		if profile, ok := emails[entity.UserID]; ok {
			request.Email = profile.Email
			request.Username = profile.Username
		}
		requests = append(requests, request)
	}
	return requests, paginationResultFromTotal(int64(total), params), nil
}

func (r *organizationQuotaRequestRepository) HasPending(
	ctx context.Context,
	organizationID int64,
	userID int64,
) (bool, error) {
	return clientFromContext(ctx, r.client).OrganizationQuotaRequest.Query().
		Where(
			organizationquotarequest.OrganizationIDEQ(organizationID),
			organizationquotarequest.UserIDEQ(userID),
			organizationquotarequest.StatusEQ(service.QuotaRequestStatusPending),
		).
		Exist(ctx)
}

// Review 在一笔事务里处理一个待处理申请。
//
// 通过（granted）：先锁申请行确认仍是待处理，再锁成员行按此刻的生效模式发放
// （周期生效加当期一次性加成，其余加静态上限），最后写终态。
// 成员此刻不限额（已无追加对象）时，申请自动作废为已驳回、额度不动，
// 返回 ErrOrganizationQuotaRequestMemberIneligible 让管理员知道没发出去。
// 驳回 / 撤回：只写终态，不碰成员行。
func (r *organizationQuotaRequestRepository) Review(
	ctx context.Context,
	organizationID int64,
	requestID int64,
	review service.OrganizationQuotaRequestReview,
) (*service.OrganizationQuotaRequest, *service.OrganizationMember, error) {
	tx, err := r.client.Tx(ctx)
	if err != nil {
		return nil, nil, err
	}
	defer func() { _ = tx.Rollback() }()

	client := tx.Client()
	entity, err := client.OrganizationQuotaRequest.Query().
		Where(
			organizationquotarequest.IDEQ(requestID),
			organizationquotarequest.OrganizationIDEQ(organizationID),
		).
		ForUpdate().
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return nil, nil, service.ErrOrganizationQuotaRequestNotFound
		}
		return nil, nil, err
	}
	if entity.Status != service.QuotaRequestStatusPending {
		return nil, nil, service.ErrOrganizationQuotaRequestNotPending
	}

	var updatedMember *service.OrganizationMember
	voided := false
	if review.Status == service.QuotaRequestStatusGranted {
		member, err := loadMemberForTopUp(ctx, client, entity.UserID)
		if err != nil {
			return nil, nil, err
		}
		if member == nil || member.EffectiveSpendingLimit(time.Now()) == nil {
			// 成员已变成不限额（或不在了）：按设计作废这笔申请，额度不动。
			voided = true
			review.Status = service.QuotaRequestStatusRejected
			if review.ReviewNote == "" {
				review.ReviewNote = "member is no longer eligible; request voided"
			}
			review.GrantSource = nil
			review.GrantedAmount = nil
		} else {
			if err := applyTopUpToMember(ctx, client, member, entity.Amount); err != nil {
				return nil, nil, err
			}
			updatedMember = member
		}
	}

	update := client.OrganizationQuotaRequest.UpdateOne(entity).
		SetStatus(review.Status).
		SetReviewerUserID(review.ReviewerUserID).
		SetReviewNote(review.ReviewNote)
	if review.GrantSource != nil {
		update = update.SetGrantSource(*review.GrantSource)
	} else {
		update = update.ClearGrantSource()
	}
	if review.GrantedAmount != nil {
		update = update.SetGrantedAmount(*review.GrantedAmount)
	} else {
		update = update.ClearGrantedAmount()
	}
	if review.Status == service.QuotaRequestStatusPending {
		update = update.ClearReviewerUserID().ClearReviewedAt()
	} else {
		update = update.SetReviewedAt(time.Now())
	}
	updated, err := update.Save(ctx)
	if err != nil {
		return nil, nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}
	request := quotaRequestEntityToService(updated)
	if voided {
		// 申请已作废为已驳回并提交，这里返回明确错误让管理员知道额度没发出去。
		return &request, nil, service.ErrOrganizationQuotaRequestMemberIneligible
	}
	return &request, updatedMember, nil
}

// loadMemberForTopUp 锁住成员行并解析当前状态；周期到期先推进（起点前移、
// 当期已用与一次性加成清零），保证发放落在当前期。成员不存在时返回 nil。
func loadMemberForTopUp(
	ctx context.Context,
	client *dbent.Client,
	userID int64,
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
	member := &service.OrganizationMember{
		UserID:          entity.UserID,
		OrganizationID:  entity.OrganizationID,
		SpendingLimit:   entity.SpendingLimit,
		SpendingUsed:    entity.SpendingUsed,
		SpendingFrozen:  entity.SpendingFrozen,
		QuotaAmount:     entity.QuotaAmount,
		QuotaPeriodDays: entity.QuotaPeriodDays,
		QuotaStartAt:    entity.QuotaStartAt,
		QuotaCycleStart: entity.QuotaCycleStart,
		QuotaCycleBonus: entity.QuotaCycleBonus,
	}
	now := time.Now()
	state := member.QuotaState(now)
	if state.NeedsAdvance && state.CycleStart != nil {
		updated, err := client.OrganizationMember.UpdateOne(entity).
			SetQuotaCycleStart(*state.CycleStart).
			SetSpendingUsed(0).
			SetQuotaCycleBonus(0).
			Save(ctx)
		if err != nil {
			return nil, err
		}
		member.QuotaCycleStart = state.CycleStart
		member.SpendingUsed = updated.SpendingUsed
		member.QuotaCycleBonus = updated.QuotaCycleBonus
	}
	return member, nil
}

// applyTopUpToMember 把一笔追加金额写进成员行：
// 周期生效中加在当期一次性加成上，其余加在静态上限上。已用、冻结不动。
func applyTopUpToMember(
	ctx context.Context,
	client *dbent.Client,
	member *service.OrganizationMember,
	amount float64,
) error {
	now := time.Now()
	state := member.QuotaState(now)
	update := client.OrganizationMember.Update().
		Where(organizationmember.UserIDEQ(member.UserID))
	if state.Mode == service.QuotaModeActive {
		bonus := service.QuantizeUsageBillingAmount(member.QuotaCycleBonus + amount)
		member.QuotaCycleBonus = bonus
		update = update.SetQuotaCycleBonus(bonus)
	} else {
		var next float64
		if member.SpendingLimit != nil {
			next = service.QuantizeUsageBillingAmount(*member.SpendingLimit + amount)
		} else {
			next = service.QuantizeUsageBillingAmount(amount)
		}
		member.SpendingLimit = &next
		update = update.SetSpendingLimit(next)
	}
	_, err := update.Save(ctx)
	return err
}

func quotaRequestEntityToService(entity *dbent.OrganizationQuotaRequest) service.OrganizationQuotaRequest {
	return service.OrganizationQuotaRequest{
		ID:             entity.ID,
		OrganizationID: entity.OrganizationID,
		UserID:         entity.UserID,
		Amount:         entity.Amount,
		Reason:         entity.Reason,
		Status:         entity.Status,
		GrantSource:    entity.GrantSource,
		GrantedAmount:  entity.GrantedAmount,
		SnapshotMode:   entity.SnapshotMode,
		SnapshotLimit:  entity.SnapshotLimit,
		SnapshotUsed:   entity.SnapshotUsed,
		ReviewerUserID: derefInt64(entity.ReviewerUserID),
		ReviewedAt:     entity.ReviewedAt,
		ReviewNote:     entity.ReviewNote,
		CreatedAt:      entity.CreatedAt,
	}
}

func applyQuotaRequestEntity(dst *service.OrganizationQuotaRequest, src *dbent.OrganizationQuotaRequest) {
	if dst == nil || src == nil {
		return
	}
	converted := quotaRequestEntityToService(src)
	converted.Email = dst.Email
	converted.Username = dst.Username
	*dst = converted
}

func derefInt64(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

var _ service.OrganizationQuotaRequestRepository = (*organizationQuotaRequestRepository)(nil)
