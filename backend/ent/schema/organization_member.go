package schema

import (
	"github.com/Wei-Shaw/sub2api/ent/schema/mixins"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// OrganizationMember records the single organization membership of a user.
type OrganizationMember struct {
	ent.Schema
}

func (OrganizationMember) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "organization_members"},
	}
}

func (OrganizationMember) Mixin() []ent.Mixin {
	return []ent.Mixin{mixins.TimeMixin{}}
}

func (OrganizationMember) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("organization_id"),
		field.Int64("user_id"),

		// 成员消费上限（USD）：
		//   nil / 未设置 → 不限额（默认），成员只受组织付款账号余额约束
		//   0            → 完全不能消费
		//   > 0          → 累计最多消费该金额
		// 注意与 api_keys.quota、users.rpm_limit 的「0 = 不限制」相反，
		// 语义对齐 user_platform_quotas。
		field.Float("spending_limit").
			Optional().
			Nillable().
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),
		// 成员累计已消费金额（USD）。本模块只读取展示，写入由组织结算模块接入。
		field.Float("spending_used").
			Default(0).
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),
	}
}

func (OrganizationMember) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("organization", Organization.Type).
			Ref("members").
			Field("organization_id").
			Required().
			Unique(),
		edge.From("user", User.Type).
			Ref("organization_membership").
			Field("user_id").
			Required().
			Unique(),
	}
}

func (OrganizationMember) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("organization_id"),
	}
}
