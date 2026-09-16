package schema

import (
	"github.com/Wei-Shaw/sub2api/ent/schema/mixins"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// OrganizationQuotaRequest 记录组织成员的配额申请流水。
//
// 成员行只表示「现在能花多少」；这张表表示要过、批过、自动发过的历史，
// 即申即加也写这里，归档才站得住。调用热路径不读这张表。
//
// 删除策略：硬删除（组织解散时随组织清理；成员关系不删除，流水长期保留）。
type OrganizationQuotaRequest struct {
	ent.Schema
}

func (OrganizationQuotaRequest) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "organization_quota_requests"},
	}
}

func (OrganizationQuotaRequest) Mixin() []ent.Mixin {
	return []ent.Mixin{mixins.TimeMixin{}}
}

func (OrganizationQuotaRequest) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("organization_id"),
		field.Int64("user_id"),

		// 申请追加的金额（USD），必须落在组织策略的最低、最高闭区间内。
		field.Float("amount").
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),
		// 申请理由，可选。
		field.String("reason").
			Optional().
			MaxLen(500),

		// 状态：pending 待处理 / granted 已发放 / rejected 已驳回 / withdrawn 已撤回。
		field.String("status").
			MaxLen(20).
			Default("pending"),
		// 发放来源：manual 管理员通过、auto 提交即发；仅 granted 时有值。
		field.String("grant_source").
			Optional().
			Nillable().
			MaxLen(20),
		// 实际加上去的金额；与申请金额通常相同。
		field.Float("granted_amount").
			Optional().
			Nillable().
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),

		// 提交时的模式快照：当时哪种配额模式、当时上限或每期金额、当时已用。
		// 归档用，发放看批准（或自动发放）那一刻的生效模式，不拿快照当依据。
		field.String("snapshot_mode").
			MaxLen(20).
			Default("static"),
		field.Float("snapshot_limit").
			Optional().
			Nillable().
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),
		field.Float("snapshot_used").
			Default(0).
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),

		// 审批人、审批时间、审批备注（驳回原因或通过备注）。
		field.Int64("reviewer_user_id").
			Optional().
			Nillable(),
		field.Time("reviewed_at").
			Optional().
			Nillable(),
		field.String("review_note").
			Optional().
			MaxLen(500),
	}
}

func (OrganizationQuotaRequest) Indexes() []ent.Index {
	return []ent.Index{
		// 管理员按组织看申请，默认只看待处理。
		index.Fields("organization_id", "status", "created_at"),
		// 成员只看自己的申请。
		index.Fields("user_id", "created_at"),
		// 先批后加模式下每人同时只能有一笔待处理，用部分唯一索引兜底，
		// 服务层先查 + 数据库约束，双保险挡住并发重复提交。
		index.Fields("user_id").
			Unique().
			StorageKey("uq_organization_quota_requests_pending_per_user").
			Annotations(entsql.IndexWhere("status = 'pending'")),
	}
}
