package schema

import (
	"github.com/Wei-Shaw/sub2api/ent/schema/mixins"
	"github.com/Wei-Shaw/sub2api/internal/domain"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// Organization holds the schema definition for a customer organization.
type Organization struct {
	ent.Schema
}

func (Organization) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "organizations"},
	}
}

func (Organization) Mixin() []ent.Mixin {
	return []ent.Mixin{mixins.TimeMixin{}}
}

func (Organization) Fields() []ent.Field {
	return []ent.Field{
		field.String("name").
			MaxLen(100).
			NotEmpty(),
		field.Int64("owner_user_id"),

		// 打开后连公开分组也必须落在 organization_allowed_groups 中，
		// 语义与 users.restrict_public_groups 一致。
		field.Bool("restrict_public_groups").
			Default(false),

		// 组织状态：disabled 表示整个组织停止服务，全体成员（含创建者）的调用一律拒绝。
		// 这一层独立于账号自身的状态，停用组织不会改写成员账号，恢复后原本被单独
		// 停用的成员仍然是停用的。
		field.String("status").
			MaxLen(20).
			Default(domain.StatusActive),

		// 配额申请策略：off 关闭（默认，成员不能申请）、approve 先批后加、
		// auto 即申即加。打开后单次最低、最高必填且最低 > 0、最高 >= 最低，
		// 由服务层校验；off 时两项为空。
		field.String("quota_request_mode").
			MaxLen(20).
			Default("off"),
		field.Float("quota_request_min").
			Optional().
			Nillable().
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),
		field.Float("quota_request_max").
			Optional().
			Nillable().
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),

		// 组织默认周期配额：开启后新成员完成加入时自动抄入这份配置，
		// 周期从加入时刻起算。关闭时金额与天数为空，由数据库 CHECK 兜底。
		field.Bool("default_quota_enabled").
			Default(false),
		field.Float("default_quota_amount").
			Optional().
			Nillable().
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),
		field.Int("default_quota_period_days").
			Optional().
			Nillable(),
	}
}

func (Organization) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("owner", User.Type).
			Ref("owned_organization").
			Field("owner_user_id").
			Required().
			Unique(),
		edge.To("members", OrganizationMember.Type),
		edge.To("invitations", RedeemCode.Type),
		edge.To("allowed_groups", Group.Type).
			Through("organization_allowed_groups", OrganizationAllowedGroup.Type),
	}
}

func (Organization) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("created_at"),
	}
}
