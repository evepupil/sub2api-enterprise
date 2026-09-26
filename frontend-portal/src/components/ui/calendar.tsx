'use client';

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import type { ChevronProps, CustomComponents, Mode } from 'react-day-picker';
import { zhCN } from 'react-day-picker/locale';

import { cn } from '../../lib/utils';

/** DayPicker 导航箭头：只用已存在的 lucide 图标，方向由原语传入。 */
function CalendarChevron({ className, orientation = 'right' }: ChevronProps) {
  const iconClassName = cn('size-4', className);
  switch (orientation) {
    case 'left':
      return <ChevronLeft className={iconClassName} aria-hidden="true" />;
    case 'up':
      return <ChevronUp className={iconClassName} aria-hidden="true" />;
    case 'down':
      return <ChevronDown className={iconClassName} aria-hidden="true" />;
    default:
      return <ChevronRight className={iconClassName} aria-hidden="true" />;
  }
}

type CalendarClassNames = NonNullable<React.ComponentProps<typeof DayPicker>['classNames']>;

/**
 * 月历内部类名：全部使用 tokens.css 语义工具类。
 * 日单元 44px（移动触控）→ 36px（桌面控件）。
 *
 * 选中态按模式区分，避免同一元素上出现互相冲突的背景工具类：
 * - single / multiple 只由 `selected` 修饰符表达；
 * - range 由 `range_start` / `range_middle` / `range_end` 表达，
 *   此时不再设置 `selected` 背景。
 * 修饰符类都作用在日期按钮的父级 td 上，用后代选择器着色，
 * 因此不会被按钮自身的悬停样式或工具类顺序影响。
 */
function buildClassNames(
  mode: Mode | undefined,
  navLayout: CalendarProps['navLayout'],
): CalendarClassNames {
  const navButton = cn(
    'inline-flex size-11 cursor-pointer items-center justify-center rounded-control text-muted-foreground outline-none',
    'transition-colors duration-150 hover:bg-muted hover:text-foreground',
    'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring',
    'disabled:cursor-not-allowed disabled:opacity-50 md:size-9',
  );

  return {
    // relative 供导航按钮绝对定位；max-w-full + overflow-x-auto 防止多月份撑破父容器。
    root: 'relative w-fit max-w-full overflow-x-auto',
    months: 'relative flex flex-col gap-4 md:flex-row',
    month: 'relative flex flex-col gap-4',
    month_caption: 'flex h-9 items-center justify-center px-9',
    caption_label: 'text-sm font-medium text-foreground',
    nav: cn(
      'flex items-center',
      navLayout === 'after' ? 'justify-end gap-2' : 'absolute inset-x-0 top-0 justify-between',
    ),
    button_previous: cn(navButton, navLayout === 'around' && 'absolute left-0 top-0'),
    button_next: cn(navButton, navLayout === 'around' && 'absolute right-0 top-0'),
    month_grid: 'w-full border-collapse',
    weekdays: 'flex',
    weekday: 'w-11 text-center text-xs font-normal text-muted-foreground md:w-9',
    week: 'mt-1 flex w-full',
    day: 'relative p-0 text-center',
    day_button: cn(
      'mx-auto flex size-11 cursor-pointer items-center justify-center rounded-control text-sm text-foreground outline-none',
      'transition-colors duration-150 hover:bg-muted',
      'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring',
      'disabled:cursor-not-allowed md:size-9',
    ),
    today: '[&>button]:font-semibold',
    outside: '[&>button]:text-muted-foreground',
    disabled: '[&>button]:opacity-50',
    hidden: 'invisible',
    range_start:
      '[&>button]:rounded-r-none [&>button]:bg-primary [&>button]:text-primary-foreground',
    range_middle: '[&>button]:bg-muted [&>button]:text-foreground',
    range_end: '[&>button]:rounded-l-none [&>button]:bg-primary [&>button]:text-primary-foreground',
    ...(mode === 'range'
      ? {}
      : {
          selected:
            '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground',
        }),
  };
}

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * 日历：DayPicker 9 的包装，接受其原始属性。
 *
 * - 默认简体中文（zhCN）且周一开始（weekStartsOn = 1）。
 * - 只处理日期，不含时分，也没有业务预选规则；single / multiple / range
 *   由调用者传 `mode`，选中值由调用者持有。
 * - 完整 aria 与键盘行为（方向键、PageUp/PageDown、Home/End、Enter/Space、
 *   焦点网格）沿用 DayPicker 9 的 Day / DayButton，不替换其交互组件。
 * - 支持 `numberOfMonths`；根节点限制宽度并允许内部横向滚动，父容器不被撑破。
 */
export function Calendar({
  className,
  classNames,
  components,
  locale = zhCN,
  weekStartsOn = 1,
  showOutsideDays = true,
  fixedWeeks = true,
  navLayout = 'around',
  ...props
}: CalendarProps) {
  const mergedComponents: Partial<CustomComponents> = { Chevron: CalendarChevron, ...components };

  return (
    <DayPicker
      {...props}
      className={cn('text-foreground', className)}
      classNames={{ ...buildClassNames(props.mode, navLayout), ...classNames }}
      components={mergedComponents}
      locale={locale}
      weekStartsOn={weekStartsOn}
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      navLayout={navLayout}
    />
  );
}
