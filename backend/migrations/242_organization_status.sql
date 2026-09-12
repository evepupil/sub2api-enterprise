-- M1 组织停用。
--
-- disabled 表示整个组织停止服务：全体成员（含组织创建者）的调用一律被拒，
-- 该组织的邀请码也不能再用来注册新人。
--
-- 这一层独立于账号自身的状态：停用组织不改写任何成员账号，
-- 恢复组织后，原本被单独停用的成员仍然是停用的。
-- 存量组织一律按启用处理。

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_status_check;

ALTER TABLE organizations
    ADD CONSTRAINT organizations_status_check
    CHECK (status IN ('active', 'disabled'));

CREATE INDEX IF NOT EXISTS organizations_status_idx ON organizations (status);
