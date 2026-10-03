import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'default' | 'inverse';

const CIRCLE: Record<Tone, string> = {
  default: 'text-neutral-700 dark:text-neutral-300',
  inverse: 'text-white',
};

const TICK_STROKE: Record<Tone, string> = {
  default: 'var(--background)',
  inverse: 'var(--navy)',
};

const TEXT: Record<Tone, string> = {
  default: 'text-muted-foreground',
  inverse: 'text-navy-foreground/90',
};

/** 带对勾圆点的列表，分组卡的特权清单用它。inverse 用在深色重点卡上。 */
export function CheckList({
  items,
  tone = 'default',
  className,
}: {
  items: readonly ReactNode[];
  tone?: Tone;
  className?: string;
}) {
  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((item, index) => (
        <li key={index} className={cn('flex items-start gap-3 text-sm', TEXT[tone])}>
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={cn('mt-px size-[18px] shrink-0', CIRCLE[tone])}
          >
            <circle cx="12" cy="12" r="10" fill="currentColor" />
            <path
              d="M8 12.5l2.5 2.5L16 9.5"
              fill="none"
              stroke={TICK_STROKE[tone]}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
