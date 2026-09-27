package repository

import (
	"context"
	"time"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/ent/organization"
	"github.com/Wei-Shaw/sub2api/ent/organizationmember"
	"github.com/Wei-Shaw/sub2api/internal/service"
)

// GetDefaultQuota 读取组织的默认周期配额配置。
func (r *organizationMemberRepository) GetDefaultQuota(
	ctx context.Context,
	organizationID int64,
) (*service.OrganizationDefaultQuota, error) {
	entity, err := clientFromContext(ctx, r.client).Organization.Query().
		Where(organization.IDEQ(organizationID)).
		Only(ctx)
	if err != nil {
		if dbent.IsNotFound(err) {
			return nil, service.ErrOrganizationNotFound
		}
		return nil, err
	}
	return &service.OrganizationDefaultQuota{
		Enabled:    entity.DefaultQuotaEnabled,
		Amount:     entity.DefaultQuotaAmount,
		PeriodDays: entity.DefaultQuotaPeriodDays,
	}, nil
}

// UpdateDefaultQuota 在一个事务里保存组织默认周期配额，并按开关同步存量成员。
//
// 同步走与单人「立即生效」相同的写入路径：被选中的普通成员当场换新一期
// （当期起点 = 现在、当期已消费清零、本期加成清零），组织创建者本人永远不动。
// 两个开关都不开（或关闭配置）时只改组织行，不碰任何成员。
func (r *organizationMemberRepository) UpdateDefaultQuota(
	ctx context.Context,
	organizationID int64,
	update service.OrganizationDefaultQuotaUpdate,
) (*service.OrganizationDefaultQuotaSynced, error) {
	var savedQuota service.OrganizationDefaultQuota
	apply := func(ctx context.Context, client *dbent.Client) ([]int64, error) {
		entity, err := client.Organization.Query().
			Where(organization.IDEQ(organizationID)).
			Only(ctx)
		if err != nil {
			if dbent.IsNotFound(err) {
				return nil, service.ErrOrganizationNotFound
			}
			return nil, err
		}

		orgUpdate := client.Organization.UpdateOne(entity)
		if update.Enabled {
			orgUpdate = orgUpdate.SetDefaultQuotaEnabled(true).
				SetDefaultQuotaAmount(update.Amount).
				SetDefaultQuotaPeriodDays(update.PeriodDays)
		} else {
			orgUpdate = orgUpdate.SetDefaultQuotaEnabled(false).
				ClearDefaultQuotaAmount().
				ClearDefaultQuotaPeriodDays()
		}
		saved, err := orgUpdate.Save(ctx)
		if err != nil {
			return nil, err
		}
		// 返回实际落库的配置，包含关闭后已清空的金额和周期。
		savedQuota = service.OrganizationDefaultQuota{
			Enabled:    saved.DefaultQuotaEnabled,
			Amount:     saved.DefaultQuotaAmount,
			PeriodDays: saved.DefaultQuotaPeriodDays,
		}

		if !update.Enabled || (!update.SyncUnconfigured && !update.SyncConfigured) {
			return nil, nil
		}

		query := client.OrganizationMember.Query().
			Where(
				organizationmember.OrganizationIDEQ(organizationID),
				organizationmember.UserIDNEQ(entity.OwnerUserID),
			)
		// 两个开关都开时不加过滤，全员统一；只开其一时按周期配额有无分流。
		if update.SyncUnconfigured && !update.SyncConfigured {
			query = query.Where(organizationmember.QuotaAmountIsNil())
		} else if !update.SyncUnconfigured && update.SyncConfigured {
			query = query.Where(organizationmember.QuotaAmountNotNil())
		}
		rows, err := query.Select(organizationmember.FieldUserID).All(ctx)
		if err != nil {
			return nil, err
		}
		if len(rows) == 0 {
			return nil, nil
		}

		now := time.Now()
		quota := service.PeriodicQuotaInput{
			Amount:     update.Amount,
			PeriodDays: update.PeriodDays,
			StartAt:    now,
		}
		userIDs := make([]int64, 0, len(rows))
		writes := make([]service.OrganizationMemberQuotaWrite, 0, len(rows))
		for _, row := range rows {
			userIDs = append(userIDs, row.UserID)
			writes = append(writes, service.OrganizationMemberQuotaWrite{
				UserID:     row.UserID,
				Quota:      &quota,
				CycleStart: &now,
				ResetUsed:  true,
			})
		}
		if err := r.SetPeriodicQuotas(ctx, organizationID, writes); err != nil {
			return nil, err
		}
		return userIDs, nil
	}

	// 组织行与成员行必须一起生效：配置保存了、存量却没同步（或反之）都是半套状态。
	if outer := dbent.TxFromContext(ctx); outer != nil {
		synced, err := apply(ctx, outer.Client())
		if err != nil {
			return nil, err
		}
		return &service.OrganizationDefaultQuotaSynced{Quota: savedQuota, SyncedUserIDs: synced}, nil
	}

	tx, err := r.client.Tx(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	// 把事务挂进 ctx，成员写入复用同一个事务。
	txCtx := dbent.NewTxContext(ctx, tx)
	synced, err := apply(txCtx, tx.Client())
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &service.OrganizationDefaultQuotaSynced{Quota: savedQuota, SyncedUserIDs: synced}, nil
}
