'use client';

/**
 * 邀请码展示辅助（纯函数 + 剪贴板动作）。
 *
 * 契约来源：design/team-and-delivery.md 页面 14 邀请码章节、
 * src/features/organization/types.ts。
 *
 * 边界：
 * - 状态文案与徽标语义一起返回，颜色不是唯一含义；已过期由 validation 的
 *   invitationStatus 派生，本模块不伪造后端状态。
 * - 注册链接只使用当前站点 origin，不写死任何域名；邀请码不是 API 秘密，
 *   表格可以明文展示，因为成员需要复制后注册。
 * - 本模块不打印邀请码或链接到日志。
 */

import type { BadgeVariant } from '../../components/ui/badge';

export type InvitationDisplayStatus = 'unused' | 'used' | 'disabled' | 'expired' | 'unknown';

const STATUS_META: Record<InvitationDisplayStatus, { label: string; variant: BadgeVariant }> = {
  unused: { label: '未使用', variant: 'success' },
  used: { label: '已使用', variant: 'neutral' },
  disabled: { label: '已作废', variant: 'warning' },
  expired: { label: '已过期', variant: 'destructive' },
  unknown: { label: '状态未知', variant: 'neutral' },
};

/** 未知或缺失状态一律按「状态未知」展示，不猜成可用。 */
export function invitationStatusMeta(status: string): { label: string; variant: BadgeVariant } {
  if (
    status === 'unused' ||
    status === 'used' ||
    status === 'disabled' ||
    status === 'expired' ||
    status === 'unknown'
  ) {
    return STATUS_META[status];
  }
  return STATUS_META.unknown;
}

/** 只有「未使用且未过期」可以作废；其余状态不提供操作。 */
export function canDisableInvitation(status: string): boolean {
  return status === 'unused';
}

/** 本站注册链接；无可用站点地址时返回 null，由调用方给出失败反馈。 */
export function invitationRegisterLink(code: string): string | null {
  if (typeof window === 'undefined' || window.location.origin === '') {
    return null;
  }
  return `${window.location.origin}/register?invitation_code=${encodeURIComponent(code)}`;
}

/** 复制纯文本；失败抛出本地中文原因，不把内容写进日志。 */
export async function copyPlainText(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
    throw new Error('当前环境不支持自动复制，请手动选择文本复制');
  }
  await navigator.clipboard.writeText(text);
}

/**
 * 日期输入（YYYY-MM-DD）转后端 RFC3339：按浏览器本地 00:00，
 * 与既有日期输入的本地时区约定一致；非法日历日返回 null。
 */
export function dateInputToRfc3339(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match === null) {
    return null;
  }
  const [, yearText, monthText, dayText] = match;
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    return null;
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date.toISOString();
}
