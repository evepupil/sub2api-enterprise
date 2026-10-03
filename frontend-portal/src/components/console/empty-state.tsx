import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * 空状态：图标圆圈、一句标题，可选一句说明和一个操作按钮。
 * 列表没有数据、筛选没有结果时都用它，交互检查找 data-empty={id}。
 */
export function EmptyState({
  id,
  icon: Icon,
  title,
  description,
  action,
  bordered = true,
  className,
}: {
  id: string;
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      data-empty={id}
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        bordered && 'rounded-xl border border-dashed border-border',
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-border bg-surface">
        <Icon aria-hidden className="size-5 text-muted-foreground" />
      </span>
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
