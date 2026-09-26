import * as React from 'react';

import { cn } from '../../lib/utils';

/** 卡片容器：白底、8px 圆角、细边框，无大阴影。 */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex flex-col gap-6 rounded-card border border-border bg-card py-6 text-card-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1.5 px-6', className)}
      {...props}
    />
  );
}

/** 标题默认 heading level 3，可通过 role/aria-level 覆盖。 */
export function CardTitle({
  className,
  role = 'heading',
  'aria-level': ariaLevel = 3,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      role={role}
      aria-level={ariaLevel}
      className={cn('text-lg font-semibold leading-tight text-card-foreground', className)}
      {...props}
    />
  );
}

/** 描述按需要选用，不自动填充。 */
export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-footer" className={cn('flex items-center px-6', className)} {...props} />
  );
}
