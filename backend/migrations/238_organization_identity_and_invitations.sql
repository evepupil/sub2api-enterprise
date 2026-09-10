-- M1 organization identity foundation. Existing users and invitation codes
-- remain personal/platform-scoped because no rows are backfilled.

CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    owner_user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_owner_user_id_key
    ON organizations (owner_user_id);

CREATE INDEX IF NOT EXISTS organizations_created_at_idx
    ON organizations (created_at);

CREATE TABLE IF NOT EXISTS organization_members (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_members_user_id_key
    ON organization_members (user_id);

CREATE INDEX IF NOT EXISTS organization_members_organization_id_idx
    ON organization_members (organization_id);

ALTER TABLE redeem_codes
    ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS redeem_codes_organization_id_idx
    ON redeem_codes (organization_id);
