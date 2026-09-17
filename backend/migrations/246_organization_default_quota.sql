-- 组织默认周期配额：开启后，新成员完成加入时自动抄入这份配置，
-- 周期从加入时刻起算，团队扩张阶段不必每来一人手工配一次。
--
-- 列语义：
--   default_quota_enabled     是否开启；关闭时金额与天数为空
--   default_quota_amount      每期金额，0 表示每期禁止消费
--   default_quota_period_days 周期天数，1 到 3650

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS default_quota_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS default_quota_amount DECIMAL(20,8),
    ADD COLUMN IF NOT EXISTS default_quota_period_days INTEGER;

ALTER TABLE organizations
    DROP CONSTRAINT IF EXISTS organizations_default_quota_check;

ALTER TABLE organizations
    ADD CONSTRAINT organizations_default_quota_check
    CHECK ((NOT default_quota_enabled AND default_quota_amount IS NULL
            AND default_quota_period_days IS NULL)
           OR (default_quota_enabled AND default_quota_amount IS NOT NULL
               AND default_quota_amount >= 0
               AND default_quota_period_days IS NOT NULL
               AND default_quota_period_days BETWEEN 1 AND 3650));
