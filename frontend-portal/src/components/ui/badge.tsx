import * as React from 'react';

import { cn } from '../../lib/utils';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'destructive';

const badgeVariantClasses: Record<BadgeVariant, string> = {
  neutral: 'border-transparent bg-secondary text-secondary-foreground',
  success: 'border-transparent bg-success/10 text-success',
  warning: 'border-transparent bg-warning/10 text-warning',
  destructive: 'border-transparent bg-destructive/10 text-destructive',
};

/**
 * 状态徽标：接收 span 属性。语义不能只靠颜色表达，调用方需传入可读文字
 * （如“可用/已停用”），Badge 只负责呈现。
 */
export function Badge({
  className,
  variant = 'neutral',
  ...props
}: React.ComponentProps<'span'> & { variant?: BadgeVariant }) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-control border px-2 py-1 text-xs font-medium leading-none',
        badgeVariantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
