import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export type BadgeTone =
  'neutral' | 'outline' | 'success' | 'warning' | 'danger' | 'info' | 'dark' | 'inverse';

const BASE =
  'inline-flex shrink-0 items-center gap-1 self-start whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-4';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  outline: 'border border-border text-muted-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  dark: 'bg-primary text-primary-foreground',
  inverse: 'border border-white/15 bg-white/10 text-navy-foreground',
};

/** 小徽标：折扣、「新」标记、分类标签。 */
export function Badge({
  tone = 'neutral',
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn(BASE, TONES[tone], className)} {...rest} />;
}
