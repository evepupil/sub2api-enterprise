package schema

import (
	"github.com/Wei-Shaw/sub2api/ent/schema/mixins"
	"github.com/Wei-Shaw/sub2api/internal/domain"

	"entgo.io/ent"
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
