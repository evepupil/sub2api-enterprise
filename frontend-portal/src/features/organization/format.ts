import { formatUsd } from '../../lib/money';

/** 组织金额：统一走 lib/money 的两位小数格式。 */
export function formatOrganizationMoney(value: number | null | undefined): string {
  return formatUsd(value);
}
export function formatOrganizationDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { hour12: false }) : '—';
}
export function organizationMemberLabel(value: {
  displayName: string;
  username: string;
  email: string;
  userId: number;
}): string {
  return (
    value.displayName.trim() ||
    value.username.trim() ||
    value.email.trim() ||
    `成员 #${value.userId}`
  );
}
