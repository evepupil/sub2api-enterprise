'use client';

import { motion, useReducedMotion } from 'motion/react';
import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * 分段切换与页签的选中滑块（借用 Aceternity Tabs 的 layoutId 做法，不引入其组件）。
 *
 * - 只在选中项里渲染；同组共用一个 layoutId，切换时 Motion 把滑块从旧选项平滑移到新选项。
 * - 选中语义（aria-pressed / aria-selected）与键盘操作仍由原按钮负责，滑块只是装饰。
 * - 使用方式（三层固定顺序：所有按钮底色 < 滑块 < 所有文字）：
 *   1. 按钮组容器加 isolate，让整组共用一个叠放层；
 *   2. 每个按钮用同一个基础样式并加 relative，按钮本身不要 isolate，否则滑块移动途中会盖住或钻到相邻按钮下面；
 *   3. 按钮文字包在 <span className="sliding-indicator-label"> 里（z-index 2），选中项文字改用主色前景色；
 *   4. 选中项内放滑块（z-index 1），它会盖住所有按钮自身的底色与描边，但始终在所有文字下方。
 * - 底色默认主色，可用 CSS 变量 --sliding-indicator-background 覆盖；减少动态时直接切换、不滑动。
 * - 节奏：官网默认 relaxed（弹性 0.45s）；控制台必须用 quick（180ms 无回弹），符合控制台 120–180ms 的反馈时长规范。
 */
export function useSlidingIndicatorId(): string {
  return `sliding-indicator-${React.useId()}`;
}

export type SlidingIndicatorPace = 'relaxed' | 'quick';

export interface SlidingIndicatorProps {
  /** 同组共用的标识，用 useSlidingIndicatorId() 生成。 */
  layoutId: string;
  /** 滑动节奏：官网 relaxed（默认），控制台 quick。 */
  pace?: SlidingIndicatorPace;
  className?: string;
}

const PACE_TRANSITIONS = {
  relaxed: { type: 'spring', bounce: 0.18, duration: 0.45 },
  quick: { type: 'tween', ease: 'easeOut', duration: 0.18 },
} as const;

export function SlidingIndicator({ layoutId, pace = 'relaxed', className }: SlidingIndicatorProps) {
  const instant = useReducedMotion() === true;

  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden="true"
      data-slot="sliding-indicator"
      className={cn('sliding-indicator', className)}
      transition={instant ? { duration: 0 } : PACE_TRANSITIONS[pace]}
    />
  );
}
