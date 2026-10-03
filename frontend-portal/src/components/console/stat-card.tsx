import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

const SIZES = {
  md: { box: 'rounded-2xl p-5 shadow-card', value: 'mt-2 text-2xl' },
  sm: { box: 'rounded-xl p-4', value: 'mt-1.5 text-lg' },
} as const;

/**
 * 数字卡：小标签（右上角可放补充信息）、大数字、下方一行说明。
 * md 用在页面顶部一排，sm 用在面板里的小格子。
 */
export function StatCard({
  id,
  label,
  value,
  aside,
  sub,
  size = 'md',
  valueClassName,
  className,
}: {
  id: string;
  label: ReactNode;
  value: ReactNode;
  aside?: ReactNode;
  sub?: ReactNode;
  size?: 'md' | 'sm';
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div
      data-stat={id}
      className={cn('min-w-0 border border-border bg-card', SIZES[size].box, className)}
    >
      <div className="flex items-start justify-between gap-3 text-xs">
        <span className="truncate text-subtle-foreground">{label}</span>
        {aside ? <span className="shrink-0 truncate text-muted-foreground">{aside}</span> : null}
      </div>
      <div
        data-stat-value
        className={cn(
          'truncate font-semibold tracking-tight tabular-nums text-foreground',
          SIZES[size].value,
          valueClassName,
        )}
      >
        {value}
      </div>
      {sub ? (
        <div
          className={cn(
            'mt-1 text-xs text-muted-foreground',
            size === 'sm' ? 'line-clamp-2 break-words' : 'truncate',
          )}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}
