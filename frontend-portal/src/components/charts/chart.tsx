'use client';

import type { EChartsOption } from 'echarts';
import * as React from 'react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

type EChartsCore = typeof import('echarts/core');
type EChartsInstance = ReturnType<EChartsCore['init']>;

let echartsReady: Promise<EChartsCore> | null = null;

function loadEcharts(): Promise<EChartsCore> {
  if (echartsReady === null) {
    echartsReady = Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ])
      .then(([core, charts, components, renderers]) => {
        core.use([
          charts.PieChart,
          charts.LineChart,
          components.TooltipComponent,
          components.GridComponent,
          components.LegendComponent,
          components.TitleComponent,
          renderers.SVGRenderer,
        ]);
        return core;
      })
      .catch((error: unknown) => {
        echartsReady = null;
        throw error;
      });
  }
  return echartsReady;
}

export function readChartColors(element: HTMLElement): string[] {
  const computed = getComputedStyle(element);
  return Array.from({ length: 6 }, (_, index) =>
    computed.getPropertyValue(`--chart-${index + 1}`).trim(),
  ).filter((color) => color !== '');
}

export interface ChartProps {
  option: EChartsOption;
  ariaLabel: string;
  className?: string;
}

/** Shared lazy ECharts host with token colors, resize handling and clean disposal. */
export function Chart({ option, ariaLabel, className }: ChartProps) {
  const elementRef = React.useRef<HTMLDivElement | null>(null);
  const chartRef = React.useRef<EChartsInstance | null>(null);
  const optionRef = React.useRef(option);
  const colorsRef = React.useRef<string[]>([]);
  const [colors, setColors] = React.useState<string[]>([]);
  const [attempt, setAttempt] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    optionRef.current = option;
  }, [option]);

  React.useEffect(() => {
    colorsRef.current = colors;
  }, [colors]);

  React.useEffect(() => {
    const element = elementRef.current;
    if (element === null) return undefined;

    setColors(readChartColors(element));
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let removeWindowResize: (() => void) | null = null;

    void loadEcharts()
      .then((core) => {
        if (disposed) return;
        const chart = core.init(element, undefined, { renderer: 'svg' });
        chartRef.current = chart;
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => chart.resize());
          resizeObserver.observe(element);
        } else {
          const onResize = (): void => chart.resize();
          window.addEventListener('resize', onResize);
          removeWindowResize = () => window.removeEventListener('resize', onResize);
        }
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        chart.setOption(
          {
            ...optionRef.current,
            ...(colorsRef.current.length > 0 ? { color: colorsRef.current } : {}),
            animation: !reducedMotion,
          },
          { notMerge: true },
        );
        chart.resize();
        setReady(true);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      removeWindowResize?.();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [attempt]);

  React.useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    chart.setOption(
      {
        ...option,
        ...(colors.length > 0 ? { color: colors } : {}),
        animation: !reducedMotion,
      },
      { notMerge: true },
    );
    chart.resize();
  }, [colors, option]);

  return (
    <div className={cn('relative', className)}>
      <div ref={elementRef} role="img" aria-label={ariaLabel} className="h-full w-full" />
      {!ready ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card text-sm text-muted-foreground"
          role={failed ? 'alert' : 'status'}
        >
          {failed ? '图表加载失败' : '正在加载图表…'}
          {failed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFailed(false);
                setReady(false);
                setAttempt((value) => value + 1);
              }}
            >
              重试
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
