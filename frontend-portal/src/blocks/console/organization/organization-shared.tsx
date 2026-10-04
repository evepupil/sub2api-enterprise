'use client';

import type { LucideIcon } from 'lucide-react';

import type { BadgeTone } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/console';
import type { QuotaRequestStatus } from '@/lib/console/live/org-types';
import { cn } from '@/lib/utils';

/** 组织页各区块（以及用量页的组织配额卡片）共用的小件：时间写法、申请状态颜色、图标按钮、失败提示 */

/** 时间只到分钟（北京时间） */
export const minuteOf = (iso: string) => formatDateTime(Date.parse(iso)).slice(0, 16);

/** 配额申请状态的徽标颜色 */
export const REQUEST_TONE: Record<QuotaRequestStatus, BadgeTone> = {
  pending: 'warning',
  granted: 'success',
  rejected: 'neutral',
  withdrawn: 'neutral',
};

/** 列表里的图标按钮：固定 size-8，名称同时写进 aria-label 和 title */
export function OrgIconButton({
  icon: Icon,
  label,
  tone = 'default',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'danger' | 'success';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-subtle-foreground transition-colors disabled:pointer-events-none disabled:opacity-40',
        tone === 'danger' && 'hover:bg-danger-soft hover:text-danger',
        tone === 'success' && 'hover:bg-success-soft hover:text-success',
        tone === 'default' && 'hover:bg-muted hover:text-foreground',
      )}
      {...rest}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

/** 区块里行上操作失败时的一句话 */
export function OrgPanelError({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p role="alert" data-org-panel-error className="text-sm text-danger">
      {message}
    </p>
  );
}
