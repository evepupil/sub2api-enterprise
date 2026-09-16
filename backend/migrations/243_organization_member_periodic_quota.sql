-- 模块后置扩展：成员周期配额。
--
-- 静态上限是一次性总额，用完只能人工再调；周期配额按期发放。
-- 到期恢复采用惰性推进：读写额度时在行锁内推进当期起点并清零当期已消费，
-- 不依赖任何后台定时任务。
--
-- 列语义：
--   quota_amount       每期金额，非空即代表配了周期配额，0 表示每期禁止消费
--   quota_period_days  周期天数，1 到 3650
--   quota_start_at     开始锚点，管理员选的开始时间，设定后不变
--   quota_cycle_start  当期起点；为空表示锚点在未来、尚未生效，生效前沿用静态上限

ALTER TABLE organization_members
    ADD COLUMN IF NOT EXISTS quota_amount DECIMAL(20,8),
    ADD COLUMN IF NOT EXISTS quota_period_days INTEGER,
    ADD COLUMN IF NOT EXISTS quota_start_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS quota_cycle_start TIMESTAMPTZ;

ALTER TABLE organization_members
    DROP CONSTRAINT IF EXISTS organization_members_quota_check;

ALTER TABLE organization_members
    ADD CONSTRAINT organization_members_quota_check
    CHECK ((quota_amount IS NULL AND quota_period_days IS NULL
            AND quota_start_at IS NULL AND quota_cycle_start IS NULL)
           OR (quota_amount IS NOT NULL AND quota_amount >= 0
               AND quota_period_days IS NOT NULL
               AND quota_period_days BETWEEN 1 AND 3650
               AND quota_start_at IS NOT NULL));
