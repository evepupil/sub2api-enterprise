'use client';

import type { EChartsOption } from 'echarts';
import { Chart } from './chart';

export interface DonutChartItem {
  name: string;
  value: number;
}

export interface DonutChartProps {
  data: readonly DonutChartItem[];
  ariaLabel: string;
  className?: string;
}

export function DonutChart({ data, ariaLabel, className = 'h-56 w-full' }: DonutChartProps) {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      renderMode: 'richText',
      formatter: (params) => {
        if (Array.isArray(params)) return '';
        return `${params.name}\n${params.value}`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: 'var(--card)', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: false } },
        data: data.map((item) => ({ name: item.name, value: item.value })),
      },
    ],
  };
  return <Chart option={option} ariaLabel={ariaLabel} className={className} />;
}
