'use client';

import { LifeBuoy, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ConsolePage } from '@/components/console/console-page';
import { CONTROL_BUTTON } from '@/components/console/control-button';
import { EmptyState } from '@/components/console/empty-state';
import { Select, type SelectOption } from '@/components/console/select';
import { Button } from '@/components/ui/button';
import {
  filterTickets,
  TICKET_STATUSES,
  TICKETS,
  type Ticket,
  type TicketStatus,
} from '@/lib/console';

import { TicketsCreateDialog } from './tickets-create-dialog';
import { TicketsDetailSheet } from './tickets-detail-sheet';
import { appendUserReply, withStatus, type TicketStatusFilter } from './tickets-logic';
import { TicketsTable } from './tickets-table';

/**
 * 工单页：状态筛选 + 工单列表 + 右侧详情抽屉 + 新建工单弹窗。
 * 工单列表只存在本页内存里：回复、改状态、新建都直接改这份列表，刷新后恢复初始数据。
 */
export function TicketsPage() {
  const t = useTranslations('consoleTickets');
  const [tickets, setTickets] = useState<Ticket[]>(() => [...TICKETS]);
  const [status, setStatus] = useState<TicketStatusFilter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = filterTickets(tickets, status);
  // 抽屉按编号在全部工单里查找。回复后工单状态改变、从当前筛选里消失时，抽屉仍留在原处
  const openTicket = tickets.find((ticket) => ticket.id === openId) ?? null;

  const statusOptions: SelectOption<TicketStatusFilter>[] = [
    { value: 'all', label: t('filter.all') },
    ...TICKET_STATUSES.map((value) => ({ value, label: t(`status.${value}`) })),
  ];

  const handleReply = (id: string, body: string) => {
    setTickets((current) =>
      current.map((ticket) => (ticket.id === id ? appendUserReply(ticket, body) : ticket)),
    );
  };

  const handleStatusChange = (id: string, next: TicketStatus) => {
    setTickets((current) =>
      current.map((ticket) => (ticket.id === id ? withStatus(ticket, next) : ticket)),
    );
  };

  /** 新工单加到最前并直接打开它的详情；当前筛选看不到「处理中」时切回全部，免得刚建的工单找不到 */
  const handleCreated = (ticket: Ticket) => {
    setTickets((current) => [ticket, ...current]);
    setStatus((current) => (current === 'all' || current === ticket.status ? current : 'all'));
    setOpenId(ticket.id);
    setCreateOpen(false);
  };

  return (
    <ConsolePage
      id="tickets"
      title={t('meta.title')}
      actions={
        <Button className={CONTROL_BUTTON} data-create-ticket onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden />
          {t('actions.create')}
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Select
          name="ticket-status"
          value={status}
          onChange={setStatus}
          options={statusOptions}
          ariaLabel={t('filter.label')}
          className="w-48"
        />
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          id="tickets"
          icon={LifeBuoy}
          title={t('empty.none.title')}
          action={<Button onClick={() => setCreateOpen(true)}>{t('empty.none.action')}</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          id="tickets"
          icon={LifeBuoy}
          title={t('empty.filtered.title')}
          action={
            <Button variant="secondary" onClick={() => setStatus('all')}>
              {t('empty.filtered.action')}
            </Button>
          }
        />
      ) : (
        <TicketsTable tickets={rows} onOpen={setOpenId} />
      )}

      <TicketsDetailSheet
        ticket={openTicket}
        onClose={() => setOpenId(null)}
        onReply={handleReply}
        onStatusChange={handleStatusChange}
      />

      {createOpen ? (
        <TicketsCreateDialog
          tickets={tickets}
          onClose={() => setCreateOpen(false)}
          onCreated={handleCreated}
        />
      ) : null}
    </ConsolePage>
  );
}
