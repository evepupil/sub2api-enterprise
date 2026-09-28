'use client';

import type { EChartsOption } from 'echarts';
import type { ChartTheme } from './chart-theme';
import { Chart } from './chart';

export interface LineChartSeries {
  name: string;
  values: readonly number[];
}

export interface LineChartProps {
  labels: readonly string[];
  series: readonly LineChartSeries[];
  ariaLabel: string;
  className?: string;
}

/** 精确匹配 YYYY-MM-DD：命中就把横轴刻度写成月/日（如 9/22）；提示框取的是原始标签，仍显示完整日期。 */
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function formatAxisDateLabel(value: string): string {
  if (!ISO_DATE_ONLY.test(value)) return value;
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return `${month}/${day}`;
}

export function LineChart({
  labels,
  series,
  ariaLabel,
  className = 'h-72 w-full',
}: LineChartProps) {
  const option = (theme: ChartTheme): EChartsOption => ({
    grid: { top: 36, right: 18, bottom: 8, left: 52, containLabel: true },
    legend: {
      top: 4,
      right: 4,
      type: 'scroll',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 16,
      textStyle: { color: theme.mutedForeground, fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: theme.surface,
      borderWidth: 0,
      borderRadius: 12,
      extraCssText: `box-shadow: ${theme.raisedShadow};`,
      textStyle: { color: theme.foreground },
      axisPointer: { type: 'line', lineStyle: { color: theme.border } },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [...labels],
      axisLabel: {
        hideOverlap: true,
        color: theme.mutedForeground,
        fontSize: 12,
        formatter: formatAxisDateLabel,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: { color: theme.mutedForeground, fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: theme.gridLine } },
    },
    series: series.map((item) => ({
      type: 'line' as const,
      name: item.name,
      data: [...item.values],
      smooth: true,
      showSymbol: false,
      symbol: 'circle',
      lineStyle: { width: 2.5 },
      emphasis: { focus: 'series' },
    })),
  });
  return <Chart option={option} ariaLabel={ariaLabel} className={className} />;
}
