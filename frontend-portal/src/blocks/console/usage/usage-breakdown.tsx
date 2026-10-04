'use client';

import { useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

import { Panel } from '@/components/console/panel';
import { Skeleton } from '@/components/console/skeleton';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { USAGE_METRICS, type DateRange, type UsageMetric } from '@/lib/console';
import type { UsageOverview } from '@/lib/console/live/usage-types';
import { seriesNames } from '@/lib/console/live/usage-view';

import { UsageBreakdownChart } from './usage-breakdown-chart';

/** 没有分组的请求，后端给的分组 ID 是 0 */
const NO_GROUP_ID = '0';

/**
 * 用量明细：一个指标开关（Token / 请求数 / 费用）控制下面三张图，
 * 分别按模型、按 API 密钥、按分组看同一段时间的用量构成。
 * overview 为 null 时还在加载，三张图的位置显示同样高度的占位块。
 */
export function UsageBreakdown({
  overview,
  range,
  metric,
  onMetricChange,
}: {
  overview: UsageOverview | null;
  range: DateRange | null;
  metric: UsageMetric;
  onMetricChange: (metric: UsageMetric) => void;
}) {
  const t = useTranslations('consoleUsage');

  const metricOptions = USAGE_METRICS.map((value) => ({ value, label: t(`detail.${value}`) }));

  // 图例里的名字：模型就是调用时的模型名；密钥、分组用后端给的名字
  const keyNames = useMemo(() => seriesNames(overview?.series.key ?? []), [overview]);
  const groupNames = useMemo(() => seriesNames(overview?.series.group ?? []), [overview]);
  const keyName = (id: string) => keyNames.get(id) ?? `#${id}`;
  const groupName = (id: string) =>
    id === NO_GROUP_ID ? t('detail.noGroup') : (groupNames.get(id) ?? `#${id}`);

  const chart = (
    id: 'by-model' | 'by-key' | 'by-group',
    dimension: 'model' | 'key' | 'group',
    seriesName: (seriesId: string) => string,
    ariaLabel: string,
    height: number,
  ): ReactNode =>
    overview && range ? (
      <UsageBreakdownChart
        id={id}
        points={overview.series[dimension]}
        range={range}
        metric={metric}
        seriesName={seriesName}
        ariaLabel={ariaLabel}
        height={height}
      />
    ) : (
      <Skeleton className="w-full" style={{ height }} />
    );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{t('detail.title')}</h2>
        <SegmentedControl
          name="usage-metric"
          size="sm"
          value={metric}
          onChange={onMetricChange}
          ariaLabel={t('detail.metric')}
          options={metricOptions}
        />
      </div>
      <div className="space-y-6">
        <Panel id="by-model" title={t('detail.byModel')}>
          {chart('by-model', 'model', (id) => id, t('detail.ariaModel'), 260)}
        </Panel>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel id="by-key" title={t('detail.byKey')}>
            {chart('by-key', 'key', keyName, t('detail.ariaKey'), 220)}
          </Panel>
          <Panel id="by-group" title={t('detail.byGroup')}>
            {chart('by-group', 'group', groupName, t('detail.ariaGroup'), 220)}
          </Panel>
        </div>
      </div>
    </section>
  );
}
