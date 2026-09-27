'use client';

import type { EChartsOption } from 'echarts';
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
  const option: EChartsOption = {
    grid: { top: 20, right: 18, bottom: 36, left: 52, containLabel: true },
    legend: { bottom: 0, type: 'scroll' },
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      axisPointer: { type: 'line' },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [...labels],
      axisLabel: { hideOverlap: true },
    },
    yAxis: { type: 'value', min: 0, splitLine: { lineStyle: { color: 'var(--border)' } } },
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
  };
  return <Chart option={option} ariaLabel={ariaLabel} className={className} />;
}
