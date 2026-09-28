'use client';

import { animate, useReducedMotion } from 'motion/react';
import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * 跟随指针的边框光（Aceternity Glowing Effect 适配版）。
 *
 * - 纯装饰层：铺满最近的定位父元素，不接收指针事件，不接管点击与焦点；父元素自己的焦点样式保持不变。
 * - 父元素需要 position: relative，圆角由父元素决定（border-radius: inherit）。
 * - 光段颜色来自 effects.css 中由主色派生的变量，组件不写颜色字面量，明暗主题随令牌切换。
 * - 用常见的「挖空内容区」遮罩只露出边框一圈，不沿用原版的双层遮罩叠加写法。
 * - 减少动态偏好、无悬停能力的设备（触屏）不监听指针；CSS 同时隐藏光层，服务端与首次客户端结构一致。
 */
export interface GlowingEffectProps {
  /** 光段半宽（度），默认 28。 */
  spread?: number;
  /** 指针在卡片外多少像素内仍会点亮，默认 64。 */
  proximity?: number;
  /** 卡片中心不点亮的区域：占短边一半的比例，默认 0.5。 */
  inactiveZone?: number;
  /** 光段转向新方向所用的秒数，默认 1。 */
  movementDuration?: number;
  className?: string;
}

const POINTER_QUERY = '(hover: hover) and (pointer: fine)';

export function GlowingEffect({
  spread = 28,
  proximity = 64,
  inactiveZone = 0.5,
  movementDuration = 1,
  className,
}: GlowingEffectProps) {
  const layerRef = React.useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();

  React.useEffect(() => {
    const layer = layerRef.current;
    if (layer === null || reducedMotion === true) {
      return;
    }
    if (!window.matchMedia(POINTER_QUERY).matches) {
      return;
    }

    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let rotation: { stop: () => void } | null = null;

    const update = () => {
      frame = 0;
      if (pointer === null) {
        return;
      }
      const { left, top, width, height } = layer.getBoundingClientRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      const nearCenter =
        Math.hypot(pointer.x - centerX, pointer.y - centerY) <
        0.5 * Math.min(width, height) * inactiveZone;
      const inRange =
        pointer.x > left - proximity &&
        pointer.x < left + width + proximity &&
        pointer.y > top - proximity &&
        pointer.y < top + height + proximity;
      const active = inRange && !nearCenter;
      layer.style.setProperty('--glow-active', active ? '1' : '0');
      if (!active) {
        return;
      }

      const current = Number.parseFloat(layer.style.getPropertyValue('--glow-start')) || 0;
      const target = (Math.atan2(pointer.y - centerY, pointer.x - centerX) * 180) / Math.PI + 90;
      // 走最短弧：把角度差归一到 [-180, 180)。
      const delta = ((((target - current + 180) % 360) + 360) % 360) - 180;
      rotation?.stop();
      rotation = animate(current, current + delta, {
        duration: movementDuration,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (value) => layer.style.setProperty('--glow-start', String(value)),
      });
    };

    const schedule = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    };
    const handlePointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('scroll', schedule);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      rotation?.stop();
      layer.style.setProperty('--glow-active', '0');
    };
  }, [reducedMotion, proximity, inactiveZone, movementDuration]);

  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      data-slot="glowing-effect"
      className={cn('glowing-effect', className)}
      style={{ '--glow-spread': String(spread) } as React.CSSProperties}
    />
  );
}
