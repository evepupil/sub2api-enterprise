import type { Localized } from '@/lib/catalog';
import {
  CONSOLE_NOW,
  TICKET_LIMITS,
  type Ticket,
  type TicketCategory,
  type TicketStatus,
} from '@/lib/console';

/** 工单页的纯业务逻辑：编号、校验、回复与状态变更。不依赖 React，方便单独测试。 */

/** 筛选下拉的取值：四种工单状态，外加「全部」 */
export type TicketStatusFilter = TicketStatus | 'all';

/** 关联请求 ID 的固定前缀：网关签发的请求 ID 都以它开头，用户填了就必须符合 */
export const REQUEST_ID_PREFIX = 'req_';

/** 账号下一张工单都没有时，新建的第一张从这个编号开始 */
const FIRST_TICKET_NUMBER = 1001;

const TICKET_ID_PATTERN = /^T-(\d+)$/;

/** 新建工单弹窗里正在填写的内容，全部是用户输入的原始文字 */
export interface TicketDraft {
  subject: string;
  category: TicketCategory;
  requestId: string;
  body: string;
}

export const EMPTY_TICKET_DRAFT: TicketDraft = {
  subject: '',
  category: 'api',
  requestId: '',
  body: '',
};

/** 会出校验错误的字段，按表单从上到下排列：校验失败时焦点落在第一个出错的字段 */
export const TICKET_DRAFT_FIELDS = ['subject', 'requestId', 'body'] as const;
export type TicketDraftField = (typeof TICKET_DRAFT_FIELDS)[number];

export type TicketDraftError =
  'subjectRequired' | 'subjectTooLong' | 'requestPrefix' | 'bodyRequired' | 'bodyTooShort';

export type TicketDraftErrors = Partial<Record<TicketDraftField, TicketDraftError>>;

/** 校验新建工单：所有出错的字段一次全部返回，界面据此同时标红 */
export function validateTicketDraft(draft: TicketDraft): TicketDraftErrors {
  const errors: TicketDraftErrors = {};

  const subject = draft.subject.trim();
  if (subject === '') errors.subject = 'subjectRequired';
  else if (subject.length > TICKET_LIMITS.subjectMax) errors.subject = 'subjectTooLong';

  // 关联请求选填：留空不校验，填了才检查前缀
  const requestId = draft.requestId.trim();
  if (requestId !== '' && !requestId.startsWith(REQUEST_ID_PREFIX)) {
    errors.requestId = 'requestPrefix';
  }

  const body = draft.body.trim();
  if (body === '') errors.body = 'bodyRequired';
  else if (body.length < TICKET_LIMITS.bodyMin) errors.body = 'bodyTooShort';

  return errors;
}

/** 新工单的编号：现有最大编号加 1（T-1024 之后是 T-1025） */
export function nextTicketId(tickets: readonly Ticket[]): string {
  let max = FIRST_TICKET_NUMBER - 1;
  for (const ticket of tickets) {
    const digits = TICKET_ID_PATTERN.exec(ticket.id)?.[1];
    if (digits !== undefined) max = Math.max(max, Number(digits));
  }
  return `T-${max + 1}`;
}

/** 用户自己写的文字没有中英文两个版本，两种语言下显示同一段 */
function sameText(text: string): Localized {
  return { zh: text, en: text };
}

/** 提交通过校验后生成新工单：状态「处理中」，第一条消息就是问题描述 */
export function buildTicket(draft: TicketDraft, existing: readonly Ticket[]): Ticket {
  const requestId = draft.requestId.trim();
  return {
    id: nextTicketId(existing),
    subject: sameText(draft.subject.trim()),
    category: draft.category,
    status: 'open',
    createdAt: CONSOLE_NOW,
    updatedAt: CONSOLE_NOW,
    requestId: requestId === '' ? null : requestId,
    messages: [{ from: 'user', ts: CONSOLE_NOW, body: sameText(draft.body.trim()) }],
  };
}

/** 用户追加一条回复：工单回到「处理中」，更新时间同步 */
export function appendUserReply(ticket: Ticket, body: string): Ticket {
  return {
    ...ticket,
    status: 'open',
    updatedAt: CONSOLE_NOW,
    messages: [...ticket.messages, { from: 'user', ts: CONSOLE_NOW, body: sameText(body) }],
  };
}

/** 用户手动把工单标记为已解决或重新打开 */
export function withStatus(ticket: Ticket, status: TicketStatus): Ticket {
  return { ...ticket, status, updatedAt: CONSOLE_NOW };
}
