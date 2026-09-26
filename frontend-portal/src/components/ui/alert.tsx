import * as React from 'react';

import { cn } from '../../lib/utils';

export type AlertVariant = 'default' | 'destructive';

const alertVariantClasses: Record<AlertVariant, string> = {
  default: 'border-border bg-card text-card-foreground',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export interface AlertProps extends React.ComponentProps<'div'> {
  /** 必填标题。 */
  title: string;
  /** 可选说明，不默认填充。 */
  description?: string;
  /** 可选操作（如“重试”按钮），直接渲染调用方传入的 ReactNode。 */
  action?: React.ReactNode;
  variant?: AlertVariant;
}

/** 提示条：variant=destructive 时作为错误反馈，role=alert 让辅助技术立即播报。 */
export function Alert({
  title,
  description,
  action,
  variant = 'default',
  className,
  ...props
}: AlertProps) {
  return (
    <div
      role={variant === 'destructive' ? 'alert' : undefined}
      data-slot="alert"
      data-variant={variant}
      className={cn(
        'flex w-full flex-col gap-1 rounded-card border px-4 py-3 text-sm',
        alertVariantClasses[variant],
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <p className="font-medium leading-snug">{title}</p>
        {description !== undefined ? (
          <p className="text-sm leading-relaxed opacity-90">{description}</p>
        ) : null}
      </div>
      {action !== undefined ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
