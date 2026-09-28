'use client';

import type * as React from 'react';

import { cn } from '../../lib/utils';
import {
  SlidingIndicator,
  useSlidingIndicatorId,
  type SlidingIndicatorPace,
} from '../effects/sliding-indicator';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** 读屏用的组名，例如「分布统计维度」。 */
  'aria-label': string;
  /** 滑动节奏：控制台默认 quick（180ms）。 */
  pace?: SlidingIndicatorPace;
  size?: 'default' | 'sm';
  /** 整组禁用，例如保存中不允许切换。 */
  disabled?: boolean;
  className?: string;
}

/**
 * 分段切换：底槽 + 浮起的选中块，选中块随切换滑动（样式见 styles/console.css）。
 *
 * - 语义沿用按钮组：role="group" + aria-pressed；Tab 逐个聚焦，空格或回车切换。
 * - 用于两到四个互斥选项的即时切换，包括切换下方内容的页签式场景。
 * - 手机触控高度不低于 44px 减去底槽内边距；桌面 30px，紧凑尺寸 26px。
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  'aria-label': ariaLabel,
  pace = 'quick',
  size = 'default',
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const indicatorId = useSlidingIndicatorId();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-slot="segmented-control"
      data-size={size}
      className={cn('segmented-control', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            className="segmented-control-option"
            onClick={() => onValueChange(option.value)}
          >
            {selected ? <SlidingIndicator layoutId={indicatorId} pace={pace} /> : null}
            <span className="sliding-indicator-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
