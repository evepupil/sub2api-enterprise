-- M1 组织分组授权。
--
-- 规则与账号侧完全一致：
--   restrict_public_groups = false（默认）→ 公开分组全部可用，专属分组只认授权表
--   restrict_public_groups = true         → 公开分组也必须出现在授权表里
--
-- 存量组织不回填，升级后都是「公开分组全放、专属分组全不给」。

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS restrict_public_groups BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS organization_allowed_groups (
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    group_id        BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_allowed_groups_group_id
    ON organization_allowed_groups(group_id);
