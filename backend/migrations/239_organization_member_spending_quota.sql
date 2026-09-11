-- M1 组织成员消费配额。
--
-- spending_limit 语义（与 user_platform_quotas 对齐，和 api_keys.quota 的
-- 「0 = 不限」相反）：
--   NULL → 不限额（默认），成员只受组织付款账号余额约束
--   0    → 完全不能消费
--   > 0  → 累计最多消费该金额
--
-- spending_used 为成员累计已消费金额，由后续「组织结算」模块写入。
-- 存量成员不回填，升级后一律是不限额状态。

ALTER TABLE organization_members
    ADD COLUMN IF NOT EXISTS spending_limit DECIMAL(20,8);

ALTER TABLE organization_members
    ADD COLUMN IF NOT EXISTS spending_used DECIMAL(20,8) NOT NULL DEFAULT 0;

ALTER TABLE organization_members
    DROP CONSTRAINT IF EXISTS organization_members_spending_non_negative_check;

ALTER TABLE organization_members
    ADD CONSTRAINT organization_members_spending_non_negative_check
    CHECK ((spending_limit IS NULL OR spending_limit >= 0) AND spending_used >= 0);
