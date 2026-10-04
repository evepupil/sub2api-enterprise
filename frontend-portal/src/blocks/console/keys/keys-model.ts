import type { AppLocale } from '@/i18n/routing';
import { formatRatio, getEdition, type EditionId } from '@/lib/catalog';
import {
  addDays,
  keyUsage,
  TODAY,
  type ApiKey,
  type KeyStatus,
  type KeyUsage,
} from '@/lib/console';

/**
 * 密钥页的数据与表单规则（纯函数，不碰界面）：列表行的形状、新建与编辑的校验、
 * 有效期换算、额度比例。界面文字不在这里，错误只返回代码，由表单按当前语言翻译。
 */

/** 列表里的一行：密钥本身加上近 30 天、今天和累计的用量 */
export interface KeyRow extends ApiKey {
  usage: KeyUsage;
}

export function toKeyRow(key: ApiKey): KeyRow {
  return { ...key, usage: keyUsage(key.id) };
}

/** 新建的密钥用量从 0 开始 */
export function emptyUsage(): KeyUsage {
  return {
    last30: { requests: 0, costUsd: 0 },
    today: { requests: 0, costUsd: 0 },
    totalCostUsd: 0,
  };
}

export const NAME_MAX_LENGTH = 32;
export const QUOTA_MIN = 1;
export const QUOTA_MAX = 100_000;

export type QuotaMode = 'unlimited' | 'custom';
export type ExpiryOption = 'never' | 'keep' | '30d' | '90d' | '1y';

/** 有效期选项对应的天数，到期日 = 今天 + 天数 */
const EXPIRY_DAYS = { '30d': 30, '90d': 90, '1y': 365 } as const;

/** 创建与编辑共用的表单草稿 */
export interface KeyDraft {
  name: string;
  quotaMode: QuotaMode;
  /** 额度输入框里的原始文字，校验通过后才转成数字 */
  quota: string;
  expiry: ExpiryOption;
}

export interface KeyFormErrors {
  name?: 'required' | 'tooLong';
  quota?: 'range';
}

/** 额度输入 → 金额；不是 1 到 100000 之间的数字时返回 null，金额保留两位小数 */
export function parseQuota(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < QUOTA_MIN || value > QUOTA_MAX) return null;
  return Math.round(value * 100) / 100;
}

/** 所有出错的字段一起返回，界面同时标红 */
export function validateKeyDraft(draft: KeyDraft): KeyFormErrors {
  const errors: KeyFormErrors = {};
  const name = draft.name.trim();
  // 按字符数（不是字节数）算「32 个字」，中文、emoji 都算一个
  if (name === '') errors.name = 'required';
  else if (Array.from(name).length > NAME_MAX_LENGTH) errors.name = 'tooLong';
  if (draft.quotaMode === 'custom' && parseQuota(draft.quota) === null) errors.quota = 'range';
  return errors;
}

/** 草稿里的额度；选「不限」时是 null */
export function resolveQuota(draft: KeyDraft): number | null {
  return draft.quotaMode === 'custom' ? parseQuota(draft.quota) : null;
}

/** 有效期选项 → 到期日；null 表示永久，keep 沿用原来的日期 */
export function resolveExpiry(option: ExpiryOption, current: string | null): string | null {
  switch (option) {
    case 'never':
      return null;
    case 'keep':
      return current;
    default:
      return addDays(TODAY, EXPIRY_DAYS[option]);
  }
}

/** 编辑后的状态：已过期的密钥改成永久或将来的日期后恢复启用，其余状态不变（到期日含当天） */
export function statusAfterEdit(status: KeyStatus, expiresAt: string | null): KeyStatus {
  if (status !== 'expired') return status;
  return expiresAt === null || expiresAt >= TODAY ? 'active' : 'expired';
}

/** 新建密钥：状态启用、用量为 0，分组创建后不能再改 */
export function buildNewKey(draft: KeyDraft, group: EditionId, secret: string): KeyRow {
  // 编号取密钥末尾的一段，不再另外生成随机数
  const suffix = secret.slice(-8).toLowerCase();
  return {
    id: `key-${suffix}`,
    name: draft.name.trim(),
    secret,
    group,
    status: 'active',
    quotaUsd: resolveQuota(draft),
    expiresAt: resolveExpiry(draft.expiry, null),
    createdAt: TODAY,
    pausedAt: null,
    // 占位数据里的这两项只给用量生成器用，新密钥没有历史调用
    share: 0,
    mix: {},
    usage: emptyUsage(),
  };
}

/** 保存编辑：名称、额度、有效期可改，分组与密钥本身不变 */
export function applyKeyEdit(row: KeyRow, draft: KeyDraft): KeyRow {
  const expiresAt = resolveExpiry(draft.expiry, row.expiresAt);
  return {
    ...row,
    name: draft.name.trim(),
    quotaUsd: resolveQuota(draft),
    expiresAt,
    status: statusAfterEdit(row.status, expiresAt),
  };
}

/** 暂停与启用互相切换，已过期的密钥不动 */
export function toggleKeyStatus(row: KeyRow): KeyRow {
  if (row.status === 'active') return { ...row, status: 'paused', pausedAt: TODAY };
  if (row.status === 'paused') return { ...row, status: 'active', pausedAt: null };
  return row;
}

/** 编辑弹窗的初始草稿：沿用密钥现在的名称、额度和有效期 */
export function draftFromKey(row: KeyRow): KeyDraft {
  return {
    name: row.name,
    quotaMode: row.quotaUsd === null ? 'unlimited' : 'custom',
    quota: row.quotaUsd === null ? '' : String(row.quotaUsd),
    expiry: row.expiresAt === null ? 'never' : 'keep',
  };
}

/** 额度已用比例 0–1（已用 = 累计花费）；不限额时为 null */
export function keyQuotaRatio(row: KeyRow): number | null {
  if (row.quotaUsd === null || row.quotaUsd <= 0) return null;
  return Math.min(1, row.usage.totalCostUsd / row.quotaUsd);
}

/** 分组的显示名：分组名加倍率，如「专用通道 ×0.3」 */
export function groupLabel(group: EditionId, locale: AppLocale): string {
  const edition = getEdition(group);
  return `${edition.name[locale]} ${formatRatio(edition.ratio, locale)}`;
}
