import * as React from 'react';

import { cn } from '../../lib/utils';

/** 加载骨架：对辅助技术隐藏；减少动态偏好下不做闪烁动画。 */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        'rounded-control bg-muted motion-safe:animate-pulse motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}
