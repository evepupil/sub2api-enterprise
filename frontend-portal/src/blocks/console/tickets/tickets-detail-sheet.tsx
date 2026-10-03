'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { CopyButton } from '@/components/console/copy-button';
import { Sheet } from '@/components/console/dialog';
import { Badge } from '@/components/ui/badge';
import type { AppLocale } from '@/i18n/routing';
import {
  formatDateTimeShort,
  type Ticket,
  type TicketMessage,
  type TicketStatus,
} from '@/lib/console';
import { cn } from '@/lib/utils';

import { TicketsReplyBar } from './tickets-reply-bar';
import { TicketStatusBadge } from './tickets-status-badge';

/** 气泡样式：客服在左、浅灰底；用户在右、深色底。完整类名按发送方映射，不拼接 */
const BUBBLE: Record<TicketMessage['from'], string> = {
  support: 'rounded-tl-md bg-muted text-foreground',
  user: 'rounded-tr-md bg-primary text-primary-foreground',
};

const ALIGN: Record<TicketMessage['from'], string> = {
  support: 'items-start',
  user: 'items-end',
};

/** 抽屉主体：顶部的状态信息，下面是客服与用户来回的对话 */
function TicketDetailBody({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('consoleTickets');
  const locale = useLocale() as AppLocale;
  const endRef = useRef<HTMLDivElement>(null);
  // 上一次看到的消息条数；null 表示刚打开，此时停在顶部，不自动滚动
  const seenCount = useRef<number | null>(null);

  // 用户发出新回复后滚到对话底部，让他看到自己刚发的那条（底部的回复框固定不动）
  useEffect(() => {
    const count = ticket.messages.length;
    if (seenCount.current !== null && count > seenCount.current) {
      endRef.current?.scrollIntoView({ block: 'end' });
    }
    seenCount.current = count;
  }, [ticket.messages.length]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <TicketStatusBadge status={ticket.status} />
        <Badge tone="outline">{t(`category.${ticket.category}`)}</Badge>
        <span className="text-xs text-subtle-foreground">
          {t('detail.createdAt', { time: formatDateTimeShort(ticket.createdAt) })}
        </span>
        {ticket.requestId ? (
          // 关联请求单独占一行：w-full 让它在换行容器里另起一行
          <div className="flex w-full min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs text-subtle-foreground">{t('detail.request')}</span>
            <span className="min-w-0 truncate font-mono text-xs text-foreground">
              {ticket.requestId}
            </span>
            <CopyButton
              name="ticket-request"
              value={ticket.requestId}
              label={t('detail.copyRequest')}
              className="size-7"
            />
          </div>
        ) : null}
      </div>

      <ol className="space-y-4 px-5 pb-5">
        {ticket.messages.map((message, index) => {
          const time = formatDateTimeShort(message.ts);
          return (
            <li
              key={index}
              data-ticket-message={message.from}
              className={cn('flex flex-col gap-1', ALIGN[message.from])}
            >
              <span className="text-xs text-subtle-foreground">
                {message.from === 'user'
                  ? t('detail.you', { time })
                  : t('detail.support', { time })}
              </span>
              {/* wrap-anywhere：粘贴进来的超长请求 ID 之类的连续字符也要换行，不撑破气泡 */}
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm wrap-anywhere',
                  BUBBLE[message.from],
                )}
              >
                {message.body[locale]}
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={endRef} />
    </>
  );
}

/**
 * 工单详情抽屉。按工单编号显示，列表里的工单被改动（回复、改状态）时抽屉内容同步更新；
 * 没有选中工单时抽屉关闭。回复与状态变更交给页面去改工单列表。
 */
export function TicketsDetailSheet({
  ticket,
  onClose,
  onReply,
  onStatusChange,
}: {
  ticket: Ticket | null;
  onClose: () => void;
  onReply: (id: string, body: string) => void;
  onStatusChange: (id: string, status: TicketStatus) => void;
}) {
  const locale = useLocale() as AppLocale;

  return (
    <Sheet
      id="ticket-detail"
      open={ticket !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        ticket ? (
          <span className="wrap-anywhere">{`#${ticket.id} ${ticket.subject[locale]}`}</span>
        ) : null
      }
      footer={
        ticket ? (
          <TicketsReplyBar
            key={ticket.id}
            ticket={ticket}
            onReply={onReply}
            onStatusChange={onStatusChange}
          />
        ) : null
      }
    >
      {ticket ? <TicketDetailBody key={ticket.id} ticket={ticket} /> : null}
    </Sheet>
  );
}
