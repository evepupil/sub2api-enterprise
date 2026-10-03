import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** 卡片面板：白底圆角描边，可带标题行（左标题、右操作）。 */
export function Panel({
  id,
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  id?: string;
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      data-panel={id}
      className={cn('min-w-0 rounded-2xl border border-border bg-card shadow-card', className)}
    >
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          {title ? (
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          ) : (
            <span aria-hidden />
          )}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
