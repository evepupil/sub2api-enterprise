'use client';

import { useEffect, useRef } from 'react';

import type { HeatCell, HeatLevel, Heatmap } from '@/lib/console/usage';
import { cn } from '@/lib/utils';

/** 深浅 5 档：0 档是空格，1–4 档同一个绿色逐级加深 */
const LEVEL: Record<HeatLevel, string> = {
  0: 'bg-muted',
  1: 'bg-success-graphic/25',
  2: 'bg-success-graphic/45',
  3: 'bg-success-graphic/70',
  4: 'bg-success-graphic',
};

const LEVELS: readonly HeatLevel[] = [0, 1, 2, 3, 4];

/** 一格 11px，间隔 3px */
const CELL = 11;
const GAP = 3;

/**
 * 活跃热力图（类似代码仓库的提交日历）：每列一周、每行一个星期几，颜色越深用量越大。
 * 每格的 title 写明日期与用量，悬停可见。宽度不够时横向滚动：打开时先停在最右边（最近几周），
 * 左侧的星期标签和底部图例固定不动，往左拖才看到更早的月份。
 * 交互检查：外层 data-heatmap，格子 data-heat-day / data-heat-level。
 */
export function ActivityHeatmap({
  data,
  monthLabel,
  cellTitle,
  ariaLabel,
  lessLabel,
  moreLabel,
  weekdayLabels,
}: {
  data: Heatmap;
  monthLabel: (month: number) => string;
  cellTitle: (cell: HeatCell) => string;
  ariaLabel: string;
  lessLabel: string;
  moreLabel: string;
  /** 周一、周三、周五三行的标签 */
  weekdayLabels: readonly [string, string, string];
}) {
  const scroller = useRef<HTMLDivElement>(null);

  // 只在首次挂载时滚到最右；之后用户怎么拖都不再干预
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);

  const rowLabels = ['', weekdayLabels[0], '', weekdayLabels[1], '', weekdayLabels[2], ''];
  return (
    <div ref={scroller} data-heatmap className="min-w-0 overflow-x-auto pb-1">
      <div role="img" aria-label={ariaLabel} className="inline-flex flex-col gap-1.5">
        <div className="relative ml-9 h-4 text-[11px] text-subtle-foreground">
          {data.months.map(({ week, month }) => (
            <span
              key={`${week}-${month}`}
              className="absolute top-0 whitespace-nowrap"
              style={{ left: week * (CELL + GAP) }}
            >
              {monthLabel(month)}
            </span>
          ))}
        </div>
        <div className="flex">
          {/* 星期标签列：横向滚动时钉在左边，底色盖住滑过去的格子 */}
          <div
            className="sticky left-0 z-10 grid w-9 shrink-0 bg-card pr-2 text-[10px] leading-[11px] text-subtle-foreground"
            style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: GAP }}
          >
            {rowLabels.map((label, index) => (
              <span key={index} className="whitespace-nowrap">
                {label}
              </span>
            ))}
          </div>
          <div
            className="grid grid-flow-col"
            style={{
              gridTemplateRows: `repeat(7, ${CELL}px)`,
              gridAutoColumns: `${CELL}px`,
              gap: GAP,
            }}
          >
            {data.weeks.flat().map((cell) => (
              <span
                key={cell.day}
                data-heat-day={cell.day}
                data-heat-level={cell.level}
                title={cell.future ? undefined : cellTitle(cell)}
                className={cn('rounded-[2px]', cell.future ? 'bg-transparent' : LEVEL[cell.level])}
              />
            ))}
          </div>
        </div>
        <div className="sticky left-0 flex w-max items-center gap-1.5 pl-9 text-[11px] text-subtle-foreground">
          <span>{lessLabel}</span>
          {LEVELS.map((level) => (
            <span
              key={level}
              aria-hidden
              className={cn('rounded-[2px]', LEVEL[level])}
              style={{ width: CELL, height: CELL }}
            />
          ))}
          <span>{moreLabel}</span>
        </div>
      </div>
    </div>
  );
}
