'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Table, TableShell, Td, Th, Tr } from '@/components/console/data-table';
import type { AppLocale } from '@/i18n/routing';
import { formatDateTimeShort, type Ticket } from '@/lib/console';

import { TicketStatusBadge } from './tickets-status-badge';

/**
 * 工单列表：编号、标题、分类、状态、更新时间。
 * 只有标题是可点的按钮（键盘可达），点开右侧的详情抽屉；窄屏整张表在外框里横向滚动。
 */
export function TicketsTable({
  tickets,
  onOpen,
}: {
  tickets: readonly Ticket[];
  onOpen: (id: string) => void;
}) {
  const t = useTranslations('consoleTickets');
  const locale = useLocale() as AppLocale;

  return (
    <TableShell id="tickets">
      <Table minWidth={720}>
        <thead>
          <tr>
            <Th>{t('table.id')}</Th>
            <Th>{t('table.subject')}</Th>
            <Th>{t('table.category')}</Th>
            <Th>{t('table.status')}</Th>
            <Th>{t('table.updatedAt')}</Th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <Tr key={ticket.id} data-ticket-row={ticket.id}>
              <Td className="whitespace-nowrap font-mono text-xs">{ticket.id}</Td>
              {/* 标题列吃掉剩余宽度，其余列保持各自的自然宽度；
                  过长的标题只显示一行，省略号加在按钮里的文字上（直接给按钮加行数截断在部分浏览器里不生效） */}
              <Td className="w-full min-w-48">
                <button
                  type="button"
                  data-ticket-open={ticket.id}
                  onClick={() => onOpen(ticket.id)}
                  className="block max-w-full cursor-pointer text-left font-medium hover:underline"
                >
                  <span className="line-clamp-1 wrap-anywhere">{ticket.subject[locale]}</span>
                </button>
              </Td>
              <Td className="whitespace-nowrap text-muted-foreground">
                {t(`category.${ticket.category}`)}
              </Td>
              <Td>
                <TicketStatusBadge status={ticket.status} data-ticket-status={ticket.status} />
              </Td>
              <Td className="whitespace-nowrap tabular-nums text-muted-foreground">
                {formatDateTimeShort(ticket.updatedAt)}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableShell>
  );
}
