-- 模块后置扩展：组织配额申请制。
--
-- 组织三种策略：off 关闭（默认）、approve 先批后加、auto 即申即加；
-- 打开后单次最低、最高必填。申请只追加一笔金额：
--   静态上限成员 → spending_limit 加上这笔；
--   周期生效成员 → 只补给当期（quota_cycle_bonus），换期或取消周期时清零。
-- 调用热路径不读申请表，只认成员身上的生效上限。

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS quota_request_mode VARCHAR(20) NOT NULL DEFAULT 'off',
    ADD COLUMN IF NOT EXISTS quota_request_min DECIMAL(20,8),
    ADD COLUMN IF NOT EXISTS quota_request_max DECIMAL(20,8);

ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_quota_request_check;
ALTER TABLE organizations
    ADD CONSTRAINT organizations_quota_request_check
    CHECK (quota_request_mode IN ('off', 'approve', 'auto')
           AND (quota_request_mode = 'off'
                OR (quota_request_min IS NOT NULL AND quota_request_min > 0
                    AND quota_request_max IS NOT NULL
                    AND quota_request_max >= quota_request_min)));

ALTER TABLE organization_members
    ADD COLUMN IF NOT EXISTS quota_cycle_bonus DECIMAL(20,8) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS organization_quota_requests (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    organization_id BIGINT NOT NULL REFERENCES organizations(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    amount DECIMAL(20,8) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    grant_source VARCHAR(20),
    granted_amount DECIMAL(20,8),
    snapshot_mode VARCHAR(20) NOT NULL DEFAULT 'static',
    snapshot_limit DECIMAL(20,8),
    snapshot_used DECIMAL(20,8) NOT NULL DEFAULT 0,
    reviewer_user_id BIGINT REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    CONSTRAINT organization_quota_requests_status_check
        CHECK (status IN ('pending', 'granted', 'rejected', 'withdrawn')),
    CONSTRAINT organization_quota_requests_source_check
        CHECK (grant_source IS NULL OR grant_source IN ('manual', 'auto')),
    CONSTRAINT organization_quota_requests_amount_check
        CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_organization_quota_requests_org_status_created
    ON organization_quota_requests (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_organization_quota_requests_user_created
    ON organization_quota_requests (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_quota_requests_pending_per_user
    ON organization_quota_requests (user_id) WHERE status = 'pending';
