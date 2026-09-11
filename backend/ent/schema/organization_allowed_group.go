package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// OrganizationAllowedGroup 记录平台授予某个组织的分组，结构与 user_allowed_groups 一致。
type OrganizationAllowedGroup struct {
	ent.Schema
}

func (OrganizationAllowedGroup) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "organization_allowed_groups"},
		// Composite primary key: (organization_id, group_id).
		field.ID("organization_id", "group_id"),
	}
}

func (OrganizationAllowedGroup) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("organization_id"),
		field.Int64("group_id"),
		field.Time("created_at").
			Immutable().
			Default(time.Now).
			SchemaType(map[string]string{dialect.Postgres: "timestamptz"}),
	}
}

func (OrganizationAllowedGroup) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("organization", Organization.Type).
			Unique().
			Required().
			Field("organization_id"),
		edge.To("group", Group.Type).
			Unique().
			Required().
			Field("group_id"),
	}
}

func (OrganizationAllowedGroup) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("group_id"),
	}
}
