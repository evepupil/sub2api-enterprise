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
		// 成员累计已消费金额（USD），由组织结算在扣费事务里累加。
		field.Float("spending_used").
			Default(0).
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),
		// 成员已冻结金额（USD）：批量出图等需要预扣的业务占用的额度，
		// 结算或取消后归零。剩余额度 = 上限 - 已消费 - 已冻结。
		field.Float("spending_frozen").
			Default(0).
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),

		// 周期配额：静态上限之外按期发放额度的另一种模式。
		//   quota_amount 非空即代表配了周期配额，每期金额 0 表示每期禁止消费；
		//   quota_start_at 是管理员选的开始锚点，设定后不变；
		//   quota_cycle_start 为空表示锚点在未来、尚未生效，生效前沿用静态上限；
		//   到期恢复采用惰性推进，由组织结算在额度读写路径上完成，无后台任务。
		field.Float("quota_amount").
			Optional().
			Nillable().
			SchemaType(map[string]string{dialect.Postgres: "decimal(20,8)"}),
		field.Int("quota_period_days").
			Optional().
			Nillable().
			Min(1).
			Max(3650),
		field.Time("quota_start_at").
			Optional().
			Nillable(),
		field.Time("quota_cycle_start").
			Optional().
			Nillable(),
		// 本期一次性加成（USD）：配额申请批准后只加在当期可花上限上，
		// 换期或取消周期时清零，不改每期金额。静态模式不使用这一列。
		field.Float("quota_cycle_bonus").
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
