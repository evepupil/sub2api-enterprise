'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { cn } from '../../lib/utils';

/**
 * 卡片组的悬停高亮（Aceternity Card Hover Effect 适配版）。
 *
 * - 只提供那块会滑动的底色：同组卡片共用一个 layoutId，处于高亮的卡片里渲染它，
 *   Motion 负责把底色从上一张卡平滑移到这一张。
 * - 由使用方记录当前高亮的卡片，并同时响应指针进入与键盘聚焦，键盘用户看到同样的反馈。
 * - 同组标识建议用 useId() 生成；原版全站共用一个标识，同页多组会互相串。
 * - 卡片需要 position: relative 与 isolation: isolate；高亮层垫在内容下方，不接收指针事件。
 * - 颜色来自 effects.css 中由主色派生的变量；减少动态时直接出现与消失，不滑动。
 */
export interface HoverHighlightProps {
  /** 同组共用的标识。 */
  layoutId: string;
  /** 当前卡片是否处于高亮。 */
  active: boolean;
  className?: string;
}

export function HoverHighlight({ layoutId, active, className }: HoverHighlightProps) {
  const instant = useReducedMotion() === true;

  return (
    <AnimatePresence>
      {active ? (
        <motion.span
          key="hover-highlight"
          layoutId={layoutId}
          aria-hidden="true"
          data-slot="hover-highlight"
          className={cn('hover-highlight', className)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: instant ? 0 : 0.15 } }}
          exit={{
            opacity: 0,
            transition: { duration: instant ? 0 : 0.15, delay: instant ? 0 : 0.2 },
          }}
          transition={instant ? { duration: 0 } : { type: 'spring', bounce: 0.15, duration: 0.4 }}
        />
      ) : null}
    </AnimatePresence>
  );
}
