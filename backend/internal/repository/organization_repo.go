package repository

import (
	"context"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/organization"
	"github.com/Wei-Shaw/sub2api/ent/organizationmember"
	"github.com/Wei-Shaw/sub2api/ent/redeemcode"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

type organizationRepository struct {
	client *dbent.Client
}

func NewOrganizationRepository(client *dbent.Client) service.OrganizationRepository {
	return &organizationRepository{client: client}
}

func (r *organizationRepository) Create(ctx context.Context, value *service.Organization) error {
	if value == nil {
		return service.ErrServiceUnavailable
	}
	created, err := clientFromContext(ctx, r.client).Organization.Create().
		SetName(value.Name).
		SetOwnerUserID(value.OwnerUserID).
		Save(ctx)
	if err != nil {
		if isUniqueConstraintViolation(err) {
			return service.ErrUserAlreadyInOrganization
		}
		return err
	}
	applyOrganizationEntity(value, created)
	return nil
}

func (r *organizationRepository) CreateMember(ctx context.Context, value *service.OrganizationMembership) error {
	if value == nil {
		return service.ErrServiceUnavailable
	}
	created, err := clientFromContext(ctx, r.client).OrganizationMember.Create().
		SetOrganizationID(value.OrganizationID).
		SetUserID(value.UserID).
		Save(ctx)
	if err != nil {
		if isUniqueConstraintViolation(err) {
			return service.ErrUserAlreadyInOrganization
		}
		return err
	}
	value.ID = created.ID
	value.CreatedAt = created.CreatedAt
	value.UpdatedAt = created.UpdatedAt
	return nil
}

func (r *organizationRepository) GetByID(ctx context.Context, id int64) (*service.Organization, error) {
	entity, err := clientFromContext(ctx, r.client).Organization.Query().
		Where(organization.IDEQ(id)).
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return nil, service.ErrOrganizationNotFound
		}
		return nil, err
	}
	return organizationEntityToService(entity), nil
}

func (r *organizationRepository) GetMembershipByUserID(ctx context.Context, userID int64) (*service.OrganizationMembership, error) {
	entity, err := clientFromContext(ctx, r.client).OrganizationMember.Query().
		Where(organizationmember.UserIDEQ(userID)).
		WithOrganization().
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return nil, service.ErrOrganizationMembershipNotFound
		}
		return nil, err
	}
	membership := &service.OrganizationMembership{
		ID:             entity.ID,
		OrganizationID: entity.OrganizationID,
		UserID:         entity.UserID,
		CreatedAt:      entity.CreatedAt,
		UpdatedAt:      entity.UpdatedAt,
	}
	if entity.Edges.Organization != nil {
		membership.Organization = organizationEntityToService(entity.Edges.Organization)
	}
	return membership, nil
}

func (r *organizationRepository) ListInvitations(ctx context.Context, organizationID int64, limit int) ([]service.RedeemCode, error) {
	if limit <= 0 || limit > 100 {
		limit = 100
	}
	entities, err := clientFromContext(ctx, r.client).RedeemCode.Query().
		Where(
			redeemcode.OrganizationIDEQ(organizationID),
			redeemcode.TypeEQ(service.RedeemTypeInvitation),
		).
		Order(dbent.Desc(redeemcode.FieldID)).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return redeemCodeEntitiesToService(entities), nil
}

func organizationEntityToService(entity *dbent.Organization) *service.Organization {
	if entity == nil {
		return nil
	}
	return &service.Organization{
		ID:          entity.ID,
		Name:        entity.Name,
		OwnerUserID: entity.OwnerUserID,
		CreatedAt:   entity.CreatedAt,
		UpdatedAt:   entity.UpdatedAt,
	}
}

func applyOrganizationEntity(dst *service.Organization, src *dbent.Organization) {
	if dst == nil || src == nil {
		return
	}
	converted := organizationEntityToService(src)
	if converted != nil {
		*dst = *converted
	}
}

var _ service.OrganizationRepository = (*organizationRepository)(nil)
