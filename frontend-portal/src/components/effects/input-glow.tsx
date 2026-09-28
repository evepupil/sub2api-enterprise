'use client';

import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'motion/react';
import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * 输入框悬停光晕（Aceternity Signup Form 输入框适配版）。
 *
 * - 包在现有输入框外面，不替换它：校验红框、触控高度、焦点环都由原输入框负责。
 * - 光晕画在输入框外沿 2px 的一圈（垫在输入框下方），外层尺寸与输入框一致，布局不变。
 * - 光晕半径随指针进入展开、离开收回，中心跟随指针；只响应鼠标，触屏不出现。
 * - 颜色来自 effects.css 中由主色派生的变量；减少动态时不出现光晕。
 */
const GLOW_RADIUS = 96;

export interface InputGlowProps {
  children: React.ReactNode;
  className?: string;
}

export function InputGlow({ children, className }: InputGlowProps) {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const radius = useMotionValue(0);
  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${x}px ${y}px, var(--input-glow-color), transparent 80%)`;

  const canGlow = (event: React.PointerEvent<HTMLDivElement>) =>
    reducedMotion !== true && event.pointerType === 'mouse';

  const track = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - rect.left);
    y.set(event.clientY - rect.top);
  };

  return (
    <div
      data-slot="input-glow"
      className={cn('input-glow', className)}
      onPointerEnter={(event) => {
        if (!canGlow(event)) {
          return;
        }
        track(event);
        animate(radius, GLOW_RADIUS, { duration: 0.3 });
      }}
      onPointerMove={(event) => {
        if (canGlow(event)) {
          track(event);
        }
      }}
      onPointerLeave={() => {
        animate(radius, 0, { duration: reducedMotion === true ? 0 : 0.3 });
      }}
    >
      <motion.span aria-hidden="true" className="input-glow-halo" style={{ background }} />
      {children}
    </div>
  );
}
