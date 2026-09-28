'use client';

import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * 移动描边包裹器（Aceternity Moving Border 适配版）。
 *
 * 契约来源：design/proactiv-redesign.md 第 3 节。
 * - 只是外框装饰，不生成第二个按钮，也不接管点击与焦点。
 * - 动效为 SVG 路径采样：沿 rect 周长取点，把光点移动到该位置。
 * - ref 使用严格类型 SVGRectElement，不使用 any。
 * - 减少动态偏好时停止逐帧计算并隐藏移动光点，保留静态描边。
 * - 装饰层始终渲染，由 CSS 隐藏减少动态下的光点，保证服务端与首次客户端结构一致。
 * - 首屏即渲染描边与内容，不依赖动画完成才可见。
 */
export interface MovingBorderProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
  /** 光点走完一圈的毫秒数，默认 6000。 */
  duration?: number;
}

export function MovingBorder({
  children,
  duration = 6000,
  className,
  ...props
}: MovingBorderProps) {
  const pathRef = React.useRef<SVGRectElement | null>(null);
  const progress = useMotionValue(0);
  const reducedMotion = useReducedMotion();

  useAnimationFrame((time) => {
    if (reducedMotion === true) {
      return;
    }
    const path = pathRef.current;
    if (path === null) {
      return;
    }
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length === 0) {
      return;
    }
    const pxPerMillisecond = length / duration;
    progress.set((time * pxPerMillisecond) % length);
  });

  const x = useTransform(progress, (value) => pathRef.current?.getPointAtLength(value).x ?? 0);
  const y = useTransform(progress, (value) => pathRef.current?.getPointAtLength(value).y ?? 0);
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;

  return (
    <div data-slot="moving-border" className={cn('moving-border', className)} {...props}>
      <div className="moving-border-decoration" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="moving-border-svg"
          width="100%"
          height="100%"
        >
          <rect ref={pathRef} fill="none" width="100%" height="100%" rx="24" ry="24" />
        </svg>
        <motion.div className="moving-border-dot" style={{ transform }} />
      </div>
      <div className="moving-border-content">{children}</div>
    </div>
  );
}
