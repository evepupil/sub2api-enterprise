-- M1 组织结算：成员已冻结金额。
--
-- 批量出图这类需要预扣的业务，提交任务时冻结组织付款账号的余额，
-- 同时在成员身上占住同样的额度；结算或取消后归零。
-- 成员剩余额度 = 上限 - 已消费 - 已冻结。

ALTER TABLE organization_members
    ADD COLUMN IF NOT EXISTS spending_frozen DECIMAL(20,8) NOT NULL DEFAULT 0;

ALTER TABLE organization_members
    DROP CONSTRAINT IF EXISTS organization_members_spending_non_negative_check;

ALTER TABLE organization_members
    ADD CONSTRAINT organization_members_spending_non_negative_check
    CHECK ((spending_limit IS NULL OR spending_limit >= 0)
           AND spending_used >= 0
           AND spending_frozen >= 0);
