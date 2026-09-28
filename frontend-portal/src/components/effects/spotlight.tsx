'use client';

import { motion, useReducedMotion } from 'motion/react';

interface SpotlightProps {
  gradientFirst?: string;
  gradientSecond?: string;
  gradientThird?: string;
  translateY?: number;
  width?: number;
  height?: number;
  smallWidth?: number;
  duration?: number;
  xOffset?: number;
}

/**
 * Adapted from the Aceternity Spotlight primitive and scoped to the marketing hero.
 *
 * 颜色默认值来自 tokens.css 的光效变量，组件不写颜色字面量。
 * 减少动态时停止左右摆动（useReducedMotion 在服务端返回 null，此时保持静态），
 * 光效本身是 CSS 背景，首屏即可见，不依赖动画完成。
 */
export function Spotlight({
  gradientFirst = 'var(--spotlight-gradient-first)',
  gradientSecond = 'var(--spotlight-gradient-second)',
  gradientThird = 'var(--spotlight-gradient-third)',
  translateY = -350,
  width = 560,
  height = 1380,
  smallWidth = 240,
  duration = 10,
  xOffset = 70,
}: SpotlightProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div aria-hidden="true" initial={false} animate={{ opacity: 1 }} className="spotlight">
      <motion.div
        className="spotlight-side spotlight-left"
        animate={{ x: reducedMotion === true ? 0 : [0, xOffset, 0] }}
        transition={{ duration, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
      >
        <div
          className="beam beam-left"
          style={{
            transform: `translateY(${translateY}px) rotate(-45deg)`,
            background: gradientFirst,
            width,
            height,
          }}
        />
        <div
          className="beam beam-left beam-left-origin"
          style={{
            transform: 'rotate(-45deg) translate(5%, -50%)',
            background: gradientSecond,
            width: smallWidth,
            height,
          }}
        />
        <div
          className="beam beam-left beam-left-origin"
          style={{
            transform: 'rotate(-45deg) translate(-180%, -70%)',
            background: gradientThird,
            width: smallWidth,
            height,
          }}
        />
      </motion.div>
      <motion.div
        className="spotlight-side spotlight-right"
        animate={{ x: reducedMotion === true ? 0 : [0, -xOffset, 0] }}
        transition={{ duration, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
      >
        <div
          className="beam beam-right"
          style={{
            transform: `translateY(${translateY}px) rotate(45deg)`,
            background: gradientFirst,
            width,
            height,
          }}
        />
        <div
          className="beam beam-right beam-right-origin"
          style={{
            transform: 'rotate(45deg) translate(-5%, -50%)',
            background: gradientSecond,
            width: smallWidth,
            height,
          }}
        />
        <div
          className="beam beam-right beam-right-origin"
          style={{
            transform: 'rotate(45deg) translate(180%, -70%)',
            background: gradientThird,
            width: smallWidth,
            height,
          }}
        />
      </motion.div>
    </motion.div>
  );
}
