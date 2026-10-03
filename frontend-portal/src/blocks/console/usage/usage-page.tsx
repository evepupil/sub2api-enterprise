'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { ConsolePage } from '@/components/console/console-page';
import { RefreshButton } from '@/components/console/refresh-button';
import { DateRangePicker } from '@/components/console/date-range-picker';
import {
  activityStats,
  dailyTotals,
  DEFAULT_RANGE,
  heatmap,
  rangeDays,
  recordsInRange,
  summarize,
  type DateRange,
  type UsageMetric,
} from '@/lib/console';

import { UsageActivity } from './usage-activity';
import { UsageBreakdown } from './usage-breakdown';
import { UsageStats } from './usage-stats';

/**
 * 全部时间的每日合计，以及据此画出的最近一年热力图。
 * 两者都和页面上选的时间范围无关，模块加载时算一次就够。
 */
const DAILY_TOTALS = dailyTotals();
const HEATMAP = heatmap(DAILY_TOTALS);

/**
 * 用量页：时间范围和明细指标是页面里仅有的两个选择，
 * 数字卡、活动统计、三张明细图都从同一份「范围内的用量记录」算出来，彼此对得上。
 */
export function UsagePage() {
  const t = useTranslations('consoleUsage');
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [metric, setMetric] = useState<UsageMetric>('tokens');

  const records = useMemo(() => recordsInRange(range), [range]);
  const summary = useMemo(() => summarize(records), [records]);
  const stats = useMemo(() => activityStats(DAILY_TOTALS, range), [range]);
  const days = useMemo(() => rangeDays(range).length, [range]);

  return (
    <ConsolePage
      id="usage"
      title={t('meta.title')}
      actions={
        <>
          <DateRangePicker value={range} onChange={setRange} />
          <RefreshButton />
        </>
      }
    >
      <UsageStats summary={summary} days={days} />
      <UsageActivity heat={HEATMAP} stats={stats} />
      <UsageBreakdown records={records} range={range} metric={metric} onMetricChange={setMetric} />
    </ConsolePage>
  );
}
