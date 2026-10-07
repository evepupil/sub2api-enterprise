'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { ConsolePage } from '@/components/console/console-page';
import { DateRangePicker } from '@/components/console/date-range-picker';
import { EmptyState } from '@/components/console/empty-state';
import { RefreshButton } from '@/components/console/refresh-button';
import { Button } from '@/components/console/button';
import {
  activityStats,
  heatmap,
  presetRange,
  rangeDays,
  type DateRange,
  type RangePreset,
  type UsageMetric,
} from '@/lib/console';
import { useLiveClock } from '@/lib/console/live/use-live-clock';
import { useUsageOverview } from '@/lib/console/live/use-usage-overview';
import {
  dailyTotalsFromBuckets,
  heatmapRange,
  mergeDailyTotals,
  summaryFromOverview,
  usageSince,
} from '@/lib/console/live/usage-view';
import { useSession } from '@/lib/session/session-provider';
import { cn } from '@/lib/utils';

import { UsageActivity } from './usage-activity';
import { UsageBreakdown } from './usage-breakdown';
import { UsageOrgQuota } from './usage-org-quota';
import { UsageStats } from './usage-stats';

const DEFAULT_PRESET: RangePreset = 'last30d';

/**
 * 用量页（接后端）：时间范围和明细指标是页面里仅有的两个选择。
 * 所选范围的数据一次取齐（数字卡、活跃统计、三张明细图），最近一年的每日合计另取一次给热力图；
 * 组织的普通成员在最上面多一张「组织配额」卡片（剩余额度、申请额度）。
 * 刷新按钮全部重取。换范围时先留着旧数据（变浅），新数据到了再换；取不到时整页显示出错与重试。
 */
export function UsagePage() {
  const t = useTranslations('consoleUsage');
  const clock = useLiveClock();
  const { user } = useSession();
  const [selected, setSelected] = useState<DateRange | null>(null);
  const [metric, setMetric] = useState<UsageMetric>('tokens');
  const [reloadKey, setReloadKey] = useState(0);

  const today = clock?.today ?? null;
  const since = today === null ? null : usageSince(user?.createdAt ?? null, today);
  // 预设范围跟着「今天」走（跨天自动更新），自定义范围原样保留
  const range = useMemo<DateRange | null>(() => {
    if (today === null || since === null) return null;
    if (selected === null) return presetRange(DEFAULT_PRESET, today, since);
    return selected.preset ? presetRange(selected.preset, today, since) : selected;
  }, [selected, today, since]);
  const year = today === null ? null : heatmapRange(today);

  const detail = useUsageOverview(range?.from ?? null, range?.to ?? null, true, reloadKey);
  const activity = useUsageOverview(year?.from ?? null, year?.to ?? null, false, reloadKey);

  // 数字卡、活跃统计、明细图都按数据自己的范围算：换范围时新数据到之前，旧数据和旧范围对得上
  const overview = detail.overview;
  const dataRange = useMemo<DateRange | null>(
    () => (overview ? { preset: null, from: overview.from, to: overview.to } : null),
    [overview],
  );
  const summary = useMemo(
    () => (overview ? summaryFromOverview(overview.summary) : null),
    [overview],
  );
  const yearTotals = useMemo(
    () => (activity.overview ? dailyTotalsFromBuckets(activity.overview.buckets) : null),
    [activity.overview],
  );
  const heat = useMemo(
    () => (yearTotals && today !== null ? heatmap(yearTotals, today) : null),
    [yearTotals, today],
  );
  const stats = useMemo(() => {
    if (!overview || !dataRange) return null;
    const totals = mergeDailyTotals(
      yearTotals ?? new Map(),
      dailyTotalsFromBuckets(overview.buckets),
    );
    return activityStats(totals, dataRange);
  }, [overview, dataRange, yearTotals]);
  const days = dataRange ? rangeDays(dataRange).length : 0;

  const error = detail.error ?? activity.error;
  const stale = overview !== null && (detail.loading || activity.loading);
  const reload = () => setReloadKey((key) => key + 1);
  const orgMember = user?.organization ? !user.organization.isOwner : false;

  return (
    <ConsolePage
      id="usage"
      title={t('meta.title')}
      actions={
        <>
          {/* 还不知道今天是哪天时（刚打开的一瞬间）先按默认范围显示按钮、按钮不可点，避免标题行跳动 */}
          <DateRangePicker
            value={range ?? presetRange(DEFAULT_PRESET)}
            onChange={setSelected}
            today={today}
            since={since}
          />
          <RefreshButton onRefresh={reload} />
        </>
      }
    >
      {orgMember ? <UsageOrgQuota reloadKey={reloadKey} /> : null}
      {error ? (
        <EmptyState
          id="usage-error"
          icon={TriangleAlert}
          title={error === 'too_many' ? t('error.tooMany') : t('error.unavailable')}
          action={
            <Button variant="secondary" onClick={reload} data-usage-retry>
              {t('error.retry')}
            </Button>
          }
        />
      ) : (
        <div
          data-usage-content
          aria-busy={detail.loading || activity.loading ? 'true' : undefined}
          className={cn('space-y-6 transition-opacity', stale && 'opacity-60')}
        >
          <UsageStats summary={summary} days={days} />
          <UsageActivity heat={heat} stats={stats} />
          <UsageBreakdown
            overview={overview}
            range={dataRange}
            metric={metric}
            onMetricChange={setMetric}
          />
        </div>
      )}
    </ConsolePage>
  );
}
