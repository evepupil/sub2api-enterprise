'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

import { ProviderLogo } from '@/components/catalog/provider-logo';
import { getProvider, type ProviderId } from '@/lib/catalog';
import { cn } from '@/lib/utils';

/** 两组厂商轮流显示，每组四个，对应四个格子 */
const LOGO_SETS: readonly [readonly ProviderId[], readonly ProviderId[]] = [
  ['openai', 'anthropic', 'google', 'deepseek'],
  ['moonshot', 'zhipu', 'minimax', 'qwen'],
];

/** 换一组的间隔，毫秒 */
const ROTATE_INTERVAL = 3000;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * 厂商标志轮换：四个格子同时换成另一组，逐格错开 0.08 秒淡入淡出。
 * 减少动态效果时停在第一组。
 */
export function ProviderLogoCloud({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const [setIndex, setSetIndex] = useState<0 | 1>(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => {
      setSetIndex((current) => (current === 0 ? 1 : 0));
    }, ROTATE_INTERVAL);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  return (
    <div
      data-logo-cloud
      data-logo-set={setIndex}
      className={cn('grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4', className)}
    >
      {LOGO_SETS[setIndex].map((providerId, cell) => (
        <div key={cell} className="flex h-14 items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={providerId}
              initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
              transition={{ duration: 0.45, delay: cell * 0.08, ease: EASE }}
              className="flex items-center gap-3"
            >
              <ProviderLogo provider={providerId} size={32} />
              <span className="text-xl font-semibold tracking-tight text-foreground/85 md:text-2xl">
                {getProvider(providerId).name}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
