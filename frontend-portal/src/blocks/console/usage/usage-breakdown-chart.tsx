'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import {
  OTHER_COLOR,
  seriesColor,
  StackedBarChart,
  type ChartLabel,
  type ChartSeries,
} from '@/components/console/charts/stacked-bar-chart';
import type { AppLocale } from '@/i18n/routing';
import {
  formatCompact,
  formatDayLabel,
  formatHour,
  formatInteger,
  formatUsd,
  OTHER_SERIES,
  type DateRange,
  type UsageMetric,
} from '@/lib/console';
import type { UsageOverviewPoint } from '@/lib/console/live/usage-types';
import { breakdownFromPoints } from '@/lib/console/live/usage-view';

/**
 * 三种指标的数字写法：Token 用紧凑写法，请求数用整数，费用用美元。
 * 柱子顶部的提示和纵轴刻度共用同一种写法。
 */
const VALUE_FORMAT: Record<UsageMetric, (value: number) => string> = {
  tokens: formatCompact,
  requests: formatInteger,
  cost: formatUsd,
};

/**
 * 用量明细的一张堆叠柱状图：一个维度（模型 / 密钥 / 通道）的后端拆分数据，
 * 范围只有一天时按 24 小时出柱子，其余按天出柱子。系列名由调用方给。
 */
export function UsageBreakdownChart({
  id,
  points,
  range,
  metric,
  seriesName,
  ariaLabel,
  height,
}: {
  id: string;
  points: readonly UsageOverviewPoint[];
  range: DateRange;
  metric: UsageMetric;
  seriesName: (seriesId: string) => string;
  ariaLabel: string;
  height: number;
}) {
  const t = useTranslations('consoleUsage');
  const locale = useLocale() as AppLocale;

  const data = useMemo(() => breakdownFromPoints(points, range, metric), [points, range, metric]);

  // 按小时的柱子带小时，按天的柱子提示框里写完整日期，方便跨月、跨年对照
  const labels: ChartLabel[] = data.buckets.map((bucket) =>
    bucket.hour === null
      ? { axis: formatDayLabel(bucket.day, locale), full: bucket.day }
      : {
          axis: formatHour(bucket.hour),
          full: `${formatDayLabel(bucket.day, locale)} ${formatHour(bucket.hour)}`,
        },
  );

  // 合并出来的「其他」固定灰色，其余系列按顺序取色
  const series: ChartSeries[] = data.series.map((item, index) =>
    item.id === OTHER_SERIES
      ? { id: item.id, label: t('detail.other'), color: OTHER_COLOR, values: item.values }
      : { id: item.id, label: seriesName(item.id), color: seriesColor(index), values: item.values },
  );

  const format = VALUE_FORMAT[metric];

  return (
    <StackedBarChart
      id={id}
      labels={labels}
      series={series}
      formatValue={format}
      formatAxis={format}
      ariaLabel={ariaLabel}
      totalLabel={t('detail.total')}
      emptyLabel={t('detail.empty')}
      height={height}
    />
  );
}
