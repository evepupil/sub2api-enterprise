'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { formatPercent } from '@/lib/console/format';

/** 系列颜色依次取用；「其他」固定用灰 */
export const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-4)',
] as const;
export const OTHER_COLOR = 'var(--chart-muted)';

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length] ?? OTHER_COLOR;
}

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  values: readonly number[];
}

export interface ChartLabel {
  /** 横轴上的短标签：9月5日 / 14:00 */
  axis: string;
  /** 提示框标题：2026-09-05 / 10月3日 14:00 */
  full: string;
}

const PAD = { top: 12, right: 8, bottom: 28, left: 56 };

/** 刻度步长取 1 / 2 / 2.5 / 5 × 10 的整数次方，纵轴最多 5 条刻度线 */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/**
 * 堆叠柱状图（手写 SVG）：每根柱子按系列堆叠，悬停或键盘左右键查看当天明细。
 * 宽度跟随容器（ResizeObserver），服务端先占好高度，避免布局跳动。
 * 交互检查：外层 data-chart={id}（data-buckets 是柱子数），提示框 data-chart-tooltip，图例 data-legend。
 */
export function StackedBarChart({
  id,
  labels,
  series,
  formatValue,
  formatAxis,
  ariaLabel,
  totalLabel,
  emptyLabel,
  height = 240,
}: {
  id: string;
  labels: readonly ChartLabel[];
  series: readonly ChartSeries[];
  formatValue: (value: number) => string;
  formatAxis?: (value: number) => string;
  ariaLabel: string;
  totalLabel: string;
  emptyLabel: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const maxTotal = Math.max(0, ...totals);
  const step = niceStep(maxTotal / 4);
  const max = maxTotal > 0 ? Math.ceil(maxTotal / step) * step : step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= max + step / 2; tick += step) ticks.push(tick);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const slot = n > 0 ? plotW / n : 0;
  const barW = Math.max(1, Math.min(32, slot * 0.62));
  const yOf = (value: number) => PAD.top + plotH - (max > 0 ? (value / max) * plotH : 0);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 64))));
  const axisFormat = formatAxis ?? formatValue;
  const empty = maxTotal === 0;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setHover((h) => (h === null ? n - 1 : Math.min(n - 1, h + 1)));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setHover((h) => (h === null ? n - 1 : Math.max(0, h - 1)));
    } else if (event.key === 'Escape') {
      setHover(null);
    }
  };

  const hoverX = hover === null ? 0 : PAD.left + (hover + 0.5) * slot;
  const tooltipOnLeft = hoverX > width / 2;
  const hovered = hover === null ? null : labels[hover];
  const hoveredTotal = hover === null ? 0 : (totals[hover] ?? 0);

  return (
    <div data-chart={id} data-buckets={n} className="min-w-0">
      <div
        ref={ref}
        tabIndex={empty ? -1 : 0}
        onKeyDown={onKeyDown}
        onBlur={() => setHover(null)}
        onMouseLeave={() => setHover(null)}
        className="relative w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10"
        style={{ height }}
      >
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block">
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={yOf(tick)}
                  y2={yOf(tick)}
                  stroke="var(--border)"
                  strokeDasharray={tick === 0 ? undefined : '3 3'}
                />
                <text
                  x={PAD.left - 8}
                  y={yOf(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--subtle-foreground)"
                  className="tabular-nums"
                >
                  {axisFormat(tick)}
                </text>
              </g>
            ))}
            {hover !== null ? (
              <rect
                x={PAD.left + hover * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="var(--muted)"
              />
            ) : null}
            {labels.map((label, i) => {
              let stacked = 0;
              return (
                <g key={label.full}>
                  {series.map((s) => {
                    const value = s.values[i] ?? 0;
                    if (value <= 0) return null;
                    const bottom = yOf(stacked);
                    stacked += value;
                    const top = yOf(stacked);
                    return (
                      <rect
                        key={s.id}
                        x={PAD.left + i * slot + (slot - barW) / 2}
                        y={top}
                        width={barW}
                        height={Math.max(0.5, bottom - top)}
                        fill={s.color}
                      />
                    );
                  })}
                  {i % labelEvery === 0 ? (
                    <text
                      x={PAD.left + (i + 0.5) * slot}
                      y={height - 8}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--subtle-foreground)"
                    >
                      {label.axis}
                    </text>
                  ) : null}
                  <rect
                    x={PAD.left + i * slot}
                    y={PAD.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                  />
                </g>
              );
            })}
          </svg>
        ) : null}
        {empty && width > 0 ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-subtle-foreground">
            {emptyLabel}
          </p>
        ) : null}
        {hovered && !empty ? (
          <div
            data-chart-tooltip
            className="pointer-events-none absolute z-10 w-60 rounded-xl border border-border bg-card p-3 text-xs shadow-card"
            style={
              tooltipOnLeft
                ? { right: width - hoverX + 12, top: PAD.top }
                : { left: hoverX + 12, top: PAD.top }
            }
          >
            <p className="font-medium text-foreground">{hovered.full}</p>
            <ul className="mt-2 space-y-1">
              {series.map((s) => {
                const value = hover === null ? 0 : (s.values[hover] ?? 0);
                if (value <= 0) return null;
                return (
                  <li key={s.id} className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
                    <span className="tabular-nums text-foreground">{formatValue(value)}</span>
                    <span className="w-11 text-right tabular-nums text-subtle-foreground">
                      {formatPercent(hoveredTotal > 0 ? value / hoveredTotal : 0)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">{totalLabel}</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatValue(hoveredTotal)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
      {series.length > 0 ? (
        <ul
          data-legend
          className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs"
        >
          {series.map((s) => (
            <li key={s.id} className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate text-muted-foreground">{s.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
