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

/** 星期标签列宽 */
const LABEL_WIDTH = 28;
/** 格子随容器宽度伸缩：最小 10px（再窄就横向滚动），最大 18px（超宽屏不至于太大） */
const CELL_MIN = 10;
const CELL_MAX = 18;
const GAP = 3;
/** 图例里的小方块 */
const LEGEND_CELL = 11;

/**
 * 活跃热力图（类似代码仓库的提交日历）：每列一周、每行一个星期几，颜色越深用量越大。
 * 格子是正方形，宽度随容器伸缩、铺满所在的一栏；容器比最小宽度还窄时横向滚动：打开时先停在最右边
 * （最近几周），左侧的星期标签固定不动，往左拖才看到更早的月份。
 * 月份、星期标签和格子放在同一个网格里，宽度怎么变都对得齐。每格的 title 写明日期与用量，悬停可见。
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

  // 只在首次挂载时滚到最右；之后用户怎么拖都不再干预（不需要滚动时这一步没有效果）
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);

  const rowLabels = ['', weekdayLabels[0], '', weekdayLabels[1], '', weekdayLabels[2], ''];
  return (
    <div ref={scroller} data-heatmap className="min-w-0 overflow-x-auto pb-1">
      <div
        role="img"
        aria-label={ariaLabel}
        // 最窄不小于每格 10px 时的宽度（min-content），更宽时格子长大铺满，最大 18px
        className="grid w-full min-w-min"
        style={{
          gridTemplateColumns: `${LABEL_WIDTH}px repeat(${data.weeks.length}, minmax(${CELL_MIN}px, ${CELL_MAX}px))`,
          gridTemplateRows: 'auto',
          gap: GAP,
        }}
      >
        {/* 第一行：月份标签放在该月第一周那一列，文字超出列宽时往右延伸；
            离右边不到两列时改成贴着最后两列靠右，免得文字伸出网格、撑出横向滚动 */}
        {data.months.map(({ week, month }) => {
          const nearEnd = week > data.weeks.length - 2;
          return (
            <span
              key={`${week}-${month}`}
              className="mb-1 whitespace-nowrap text-[11px] leading-4 text-subtle-foreground"
              style={
                nearEnd
                  ? { gridRow: 1, gridColumn: `${data.weeks.length} / span 2`, justifySelf: 'end' }
                  : { gridRow: 1, gridColumn: week + 2 }
              }
            >
              {monthLabel(month)}
            </span>
          );
        })}
        {/* 左上角：横向滚动时盖住滑到星期标签列上方的月份标签 */}
        <span
          aria-hidden
          className="sticky left-0 z-10 bg-card"
          style={{ gridRow: 1, gridColumn: 1 }}
        />
        {/* 第一列：星期标签，横向滚动时钉在左边，底色盖住滑过去的格子 */}
        {rowLabels.map((label, index) => (
          <span
            key={`weekday-${index}`}
            className="sticky left-0 z-10 flex items-center bg-card pr-2 text-[10px] leading-none text-subtle-foreground"
            style={{ gridRow: index + 2, gridColumn: 1 }}
          >
            {label}
          </span>
        ))}
        {data.weeks.map((week, weekIndex) =>
          week.map((cell, dayIndex) => (
            <span
              key={cell.day}
              data-heat-day={cell.day}
              data-heat-level={cell.level}
              title={cell.future ? undefined : cellTitle(cell)}
              className={cn(
                'aspect-square rounded-[3px]',
                cell.future ? 'bg-transparent' : LEVEL[cell.level],
              )}
              style={{ gridRow: dayIndex + 2, gridColumn: weekIndex + 2 }}
            />
          )),
        )}
      </div>
      <div
        className="sticky left-0 mt-2.5 flex w-max items-center gap-1.5 text-[11px] text-subtle-foreground"
        style={{ paddingLeft: LABEL_WIDTH + GAP }}
      >
        <span>{lessLabel}</span>
        {LEVELS.map((level) => (
          <span
            key={level}
            aria-hidden
            className={cn('rounded-[2px]', LEVEL[level])}
            style={{ width: LEGEND_CELL, height: LEGEND_CELL }}
          />
        ))}
        <span>{moreLabel}</span>
      </div>
    </div>
  );
}
