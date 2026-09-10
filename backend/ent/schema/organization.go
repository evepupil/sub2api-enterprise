package schema

import (
	"github.com/Wei-Shaw/sub2api/ent/schema/mixins"

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
	}
}

func (Organization) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("created_at"),
	}
}
