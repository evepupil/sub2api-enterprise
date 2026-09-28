'use client';

import type { EChartsOption } from 'echarts';
import type { ChartTheme } from './chart-theme';
import { Chart } from './chart';
import { escapeHtml } from '../../lib/html';
import { cn } from '../../lib/utils';

export interface DonutChartItem {
  name: string;
  value: number;
}

export interface DonutChartProps {
  data: readonly DonutChartItem[];
  ariaLabel: string;
  className?: string;
  centerValue?: string;
  centerLabel?: string;
  centerTitle?: string;
}

const EMPTY_CHART_ITEM = '__empty_donut__';

/** 分段缝隙用表面色描边模拟：无论切片多细都不会被裁没，比角度缝（padAngle）更贴合长尾小占比明细行。 */
const SEGMENT_GAP_WIDTH = 2;
const SEGMENT_CORNER_RADIUS = 6;

export function DonutChart({
  data,
  ariaLabel,
  className = 'h-56 w-full',
  centerValue,
  centerLabel,
  centerTitle,
}: DonutChartProps) {
  const hasPositiveValue = data.some((item) => item.value > 0);
  const option = (theme: ChartTheme): EChartsOption => ({
    tooltip: {
      show: hasPositiveValue,
      trigger: 'item',
      confine: true,
      backgroundColor: theme.surface,
      borderWidth: 0,
      borderRadius: 12,
      extraCssText: `box-shadow: ${theme.raisedShadow};`,
      textStyle: { color: theme.foreground },
      formatter: (params) => {
        if (Array.isArray(params)) return '';
        return `${escapeHtml(String(params.name))}<br/>${escapeHtml(String(params.value))}`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['48%', '72%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: theme.surface,
          borderWidth: SEGMENT_GAP_WIDTH,
          borderRadius: SEGMENT_CORNER_RADIUS,
        },
        label: { show: false },
        emphasis: { label: { show: false } },
        data: hasPositiveValue
          ? data.map((item) => ({ name: item.name, value: item.value }))
          : [{ name: EMPTY_CHART_ITEM, value: 1, itemStyle: { color: theme.border } }],
      },
    ],
  });
  const showCenter = centerValue !== undefined || centerLabel !== undefined;

  return (
    <div className={cn('relative', className)}>
      <Chart option={option} ariaLabel={ariaLabel} className="h-full w-full" />
      {showCenter ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          {centerValue !== undefined ? (
            <p
              className="pointer-events-auto max-w-full break-all text-base font-semibold tabular-nums text-foreground"
              title={centerTitle}
            >
              {centerValue}
            </p>
          ) : null}
          {centerLabel !== undefined ? (
            <p className="text-xs text-muted-foreground">{centerLabel}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
