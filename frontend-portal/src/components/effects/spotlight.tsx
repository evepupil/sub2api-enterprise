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

/** Adapted from the Aceternity Spotlight primitive and scoped to the marketing hero. */
export function Spotlight({
  gradientFirst = 'radial-gradient(68.54% 68.72% at 55.02% 31.46%, rgba(106,119,135,.14) 0, rgba(106,119,135,.04) 50%, transparent 80%)',
  gradientSecond = 'radial-gradient(50% 50% at 50% 50%, rgba(106,119,135,.10) 0, rgba(106,119,135,.03) 80%, transparent 100%)',
  gradientThird = 'radial-gradient(50% 50% at 50% 50%, rgba(106,119,135,.06) 0, rgba(106,119,135,.02) 80%, transparent 100%)',
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
        animate={{ x: reducedMotion ? 0 : [0, xOffset, 0] }}
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
        animate={{ x: reducedMotion ? 0 : [0, -xOffset, 0] }}
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
