/**
 * 密钥列表与详情的展示格式化（纯函数，无网络、无副作用）。
 *
 * 契约来源：design/console-pages.md 密钥章节。
 *
 * 边界：
 * - 只做展示层换算，不改动数据；金额统一按后端币种 USD 展示。
 * - 时间为后端 ISO 文本，按浏览器本地时区展示；null 显示占位而不是伪造时间。
 * - 状态文案与徽标语义一起返回，避免颜色成为唯一含义。
 */

import type { BadgeVariant } from '../../components/ui/badge';
import { formatUsd as formatUsdAmount } from '../../lib/money';
import type { KeyRecord } from './types';

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' });

const numberFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });

/** 金额：统一走 lib/money 的两位小数格式。 */
export function formatUsd(value: number): string {
  return formatUsdAmount(value);
}

export function formatCount(value: number): string {
  return Number.isFinite(value) ? numberFormatter.format(value) : '—';
}

/** 额度列：0 表示不限，与「未返回值」区分开。 */
export function formatQuota(used: number, total: number): string {
  if (!(total > 0)) {
    return `已用 ${formatUsd(used)} / 不限`;
  }
  return `已用 ${formatUsd(used)} / ${formatUsd(total)}`;
}

export function formatDateTime(iso: string | null): string {
  if (iso === null) {
    return '—';
  }
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return '—';
  }
  return dateTimeFormatter.format(new Date(timestamp));
}

export function formatDate(iso: string | null): string {
  if (iso === null) {
    return '—';
  }
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return '—';
  }
  return dateFormatter.format(new Date(timestamp));
}

/** 有效期列：未设置过期时间表示长期有效。 */
export function formatExpiry(record: KeyRecord): string {
  return record.expiresAt === null ? '长期有效' : formatDate(record.expiresAt);
}

export function isKeyActive(record: KeyRecord): boolean {
  return record.status === 'active';
}

/** 只有 active/inactive 允许直接切换；其余状态必须通过编辑额度/有效期解决。 */
export type KeyToggleTarget = 'active' | 'inactive';

export function keyToggleTarget(status: string): KeyToggleTarget | null {
  if (status === 'active') {
    return 'inactive';
  }
  if (status === 'inactive') {
    return 'active';
  }
  return null;
}

/** 不可直接切换时的原因提示；未知状态不猜测原因，返回 null。 */
export function keyStatusHint(status: string): string | null {
  if (status === 'expired') {
    return '密钥已过期，请编辑有效期后再启用';
  }
  if (status === 'quota_exhausted') {
    return '额度已用完，请编辑额度后再启用';
  }
  if (status === 'disabled') {
    return '密钥已被禁用，无法直接启用';
  }
  return null;
}

/** 状态文案与徽标语义：颜色不是唯一含义，文字必须能独立说明状态。 */
export function keyStatusLabel(status: string): { label: string; variant: BadgeVariant } {
  if (status === 'active') {
    return { label: '可用', variant: 'success' };
  }
  if (status === 'inactive') {
    return { label: '已停用', variant: 'warning' };
  }
  if (status === 'disabled') {
    return { label: '已禁用', variant: 'warning' };
  }
  if (status === 'expired') {
    return { label: '已过期', variant: 'warning' };
  }
  if (status === 'quota_exhausted') {
    return { label: '额度用完', variant: 'destructive' };
  }
  return { label: status === '' ? '未知' : status, variant: 'neutral' };
}

/** 状态下拉选项（不含「全部」哨兵值，哨兵由调用方提供）。 */
export const KEY_STATUS_FILTER_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'active', label: '可用' },
  { value: 'inactive', label: '已停用' },
  { value: 'disabled', label: '已禁用' },
  { value: 'expired', label: '已过期' },
  { value: 'quota_exhausted', label: '额度用完' },
];

/**
 * 表单/操作错误文案。
 *
 * 本模块能抛出的 Error 都是本地生成的：请求层 ApiError 带安全中文文案，
 * validation/adapter 抛出的是字段原因，都不含后端原文；非 Error 一律用兜底文案。
 */
export function safeKeyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return fallback;
}
