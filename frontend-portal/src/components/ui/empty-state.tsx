import * as React from 'react';

import { cn } from '../../lib/utils';

export interface EmptyStateProps extends React.ComponentProps<'div'> {
  /** 必填主文案。 */
  title: string;
  /** 可选说明，不默认灌水。 */
  description?: string;
  /** 可选操作，直接渲染调用方传入的 ReactNode（如 Button）。 */
  action?: React.ReactNode;
}

/** 空状态：只有调用方提供 description/action 时才渲染。 */
export function EmptyState({ title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-card px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description !== undefined ? (
        <p className="max-w-dialog text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
