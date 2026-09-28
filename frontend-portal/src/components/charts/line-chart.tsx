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

export function LineChart({
  labels,
  series,
  ariaLabel,
  className = 'h-72 w-full',
}: LineChartProps) {
  const option = (theme: ChartTheme): EChartsOption => ({
    grid: { top: 20, right: 18, bottom: 36, left: 52, containLabel: true },
    legend: {
      bottom: 0,
      type: 'scroll',
      textStyle: { color: theme.mutedForeground },
    },
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderWidth: 1,
      textStyle: { color: theme.foreground },
      axisPointer: { type: 'line', lineStyle: { color: theme.border } },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [...labels],
      axisLabel: { hideOverlap: true, color: theme.mutedForeground },
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: { color: theme.mutedForeground },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: theme.border } },
    },
    series: series.map((item) => ({
      type: 'line' as const,
      name: item.name,
      data: [...item.values],
      smooth: false,
      showSymbol: false,
      symbol: 'circle',
      lineStyle: { width: 2 },
      emphasis: { focus: 'series' },
    })),
  });
  return <Chart option={option} ariaLabel={ariaLabel} className={className} />;
}
