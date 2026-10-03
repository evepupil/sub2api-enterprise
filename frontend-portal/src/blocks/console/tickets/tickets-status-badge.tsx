'use client';

import { useTranslations } from 'next-intl';
import type { HTMLAttributes } from 'react';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { TicketStatus } from '@/lib/console';

/** 状态徽标颜色：处理中蓝、待你回复黄、已解决绿、已关闭灰 */
const STATUS_TONE: Record<TicketStatus, BadgeTone> = {
  open: 'info',
  awaiting: 'warning',
  resolved: 'success',
  closed: 'neutral',
};

/** 工单状态徽标：列表和详情抽屉共用，额外属性（如检查用的 data-*）原样传给徽标 */
export function TicketStatusBadge({
  status,
  ...rest
}: { status: TicketStatus } & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>) {
  const t = useTranslations('consoleTickets');
  return (
    <Badge tone={STATUS_TONE[status]} {...rest}>
      {t(`status.${status}`)}
    </Badge>
  );
}
