import type { Localized } from '@/lib/catalog';

import { dayStart, HOUR_MS } from './time';

/** 工单（占位数据）。客服回复与用户回复按时间排成一条对话。 */
export type TicketStatus = 'open' | 'awaiting' | 'resolved' | 'closed';
export const TICKET_STATUSES: readonly TicketStatus[] = ['open', 'awaiting', 'resolved', 'closed'];

export type TicketCategory = 'api' | 'billing' | 'account' | 'other';
export const TICKET_CATEGORIES: readonly TicketCategory[] = ['api', 'billing', 'account', 'other'];

export interface TicketMessage {
  from: 'user' | 'support';
  ts: number;
  body: Localized;
}

export interface Ticket {
  id: string;
  subject: Localized;
  category: TicketCategory;
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
  /** 关联的请求 ID（可选） */
  requestId: string | null;
  messages: TicketMessage[];
}

const at = (day: string, hour: number, minute = 0) =>
  dayStart(day) + hour * HOUR_MS + minute * 60_000;

export const TICKETS: readonly Ticket[] = [
  {
    id: 'T-1024',
    subject: { zh: '生图接口偶发超时', en: 'Image API times out occasionally' },
    category: 'api',
    status: 'open',
    createdAt: at('2026-10-02', 16, 12),
    updatedAt: at('2026-10-03', 10, 5),
    requestId: 'req_Hq3ZkP0aV9sLm2Rt7Yx1',
    messages: [
      {
        from: 'user',
        ts: at('2026-10-02', 16, 12),
        body: {
          zh: '昨天下午开始，gpt-image-2 大约每 20 次请求有 1 次 60 秒超时，附上一个请求 ID。',
          en: 'Since yesterday afternoon about 1 in 20 gpt-image-2 requests times out after 60 s. Request ID attached.',
        },
      },
      {
        from: 'support',
        ts: at('2026-10-03', 10, 5),
        body: {
          zh: '已定位到一个上游节点响应变慢，正在切换渠道，处理完会在这里回复。',
          en: 'We traced it to a slow upstream node and are switching channels. We will follow up here.',
        },
      },
    ],
  },
  {
    id: 'T-1019',
    subject: { zh: '申请开具 9 月发票', en: 'Invoice for September' },
    category: 'billing',
    status: 'resolved',
    createdAt: at('2026-09-26', 9, 40),
    updatedAt: at('2026-09-28', 14, 20),
    requestId: null,
    messages: [
      {
        from: 'user',
        ts: at('2026-09-26', 9, 40),
        body: {
          zh: '请按组织信息开具 9 月的增值税普通发票。',
          en: 'Please issue a VAT invoice for September using our organization details.',
        },
      },
      {
        from: 'support',
        ts: at('2026-09-28', 14, 20),
        body: {
          zh: '发票已发送到账单邮箱，请查收。',
          en: 'The invoice has been sent to your billing email.',
        },
      },
    ],
  },
  {
    id: 'T-1011',
    subject: { zh: '组织成员无法创建密钥', en: 'Members cannot create API keys' },
    category: 'account',
    status: 'awaiting',
    createdAt: at('2026-09-14', 11, 2),
    updatedAt: at('2026-09-15', 17, 45),
    requestId: null,
    messages: [
      {
        from: 'user',
        ts: at('2026-09-14', 11, 2),
        body: {
          zh: '新加入的成员点创建密钥时提示没有可用分组。',
          en: 'New members see “no available group” when creating a key.',
        },
      },
      {
        from: 'support',
        ts: at('2026-09-15', 17, 45),
        body: {
          zh: '需要组织管理员在成员管理里给他们授权分组，授权后能否正常创建？',
          en: 'An organization admin needs to grant them a group under Members. Does it work after that?',
        },
      },
    ],
  },
];

export function filterTickets(tickets: readonly Ticket[], status: TicketStatus | 'all'): Ticket[] {
  return tickets
    .filter((ticket) => status === 'all' || ticket.status === status)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 新工单的标题与描述长度限制 */
export const TICKET_LIMITS = { subjectMax: 80, bodyMin: 10, bodyMax: 2000 };
