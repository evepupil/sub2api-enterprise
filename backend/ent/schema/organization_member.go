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
