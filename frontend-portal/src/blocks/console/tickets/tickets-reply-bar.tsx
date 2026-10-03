'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { TICKET_LIMITS, type Ticket, type TicketStatus } from '@/lib/console';
import { Textarea } from '@/components/ui/textarea';

/**
 * 详情抽屉底部：回复框加两个按钮。
 * 已关闭的工单不能再回复，只显示一句说明；已解决的工单左边按钮换成「重新打开」。
 * 回复草稿只存在这里，抽屉关闭或换一张工单（父级用工单编号当 key）就清空。
 */
export function TicketsReplyBar({
  ticket,
  onReply,
  onStatusChange,
}: {
  ticket: Ticket;
  onReply: (id: string, body: string) => void;
  onStatusChange: (id: string, status: TicketStatus) => void;
}) {
  const t = useTranslations('consoleTickets');
  const [reply, setReply] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  if (ticket.status === 'closed') {
    return <p className="text-sm text-subtle-foreground">{t('detail.closed')}</p>;
  }

  const canSend = reply.trim() !== '';

  const send = () => {
    if (!canSend) return;
    onReply(ticket.id, reply.trim());
    setReply('');
    // 发送后「发送」按钮会变灰，焦点还给回复框，键盘用户可以接着写
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <Textarea
        ref={inputRef}
        id="ticket-reply"
        rows={3}
        maxLength={TICKET_LIMITS.bodyMax}
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        placeholder={t('detail.reply.placeholder')}
        aria-label={t('detail.reply.label')}
        className="resize-none"
      />
      <div className="flex items-center justify-between gap-3">
        {ticket.status === 'resolved' ? (
          <Button
            variant="secondary"
            data-ticket-reopen
            onClick={() => onStatusChange(ticket.id, 'open')}
          >
            {t('detail.reply.reopen')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            data-ticket-resolve
            onClick={() => onStatusChange(ticket.id, 'resolved')}
          >
            {t('detail.reply.resolve')}
          </Button>
        )}
        <Button data-ticket-send disabled={!canSend} onClick={send}>
          {t('detail.reply.send')}
        </Button>
      </div>
    </div>
  );
}
