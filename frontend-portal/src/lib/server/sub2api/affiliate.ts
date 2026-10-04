import type {
  AffiliateDetail,
  AffiliateInvitee,
  AffiliateTransfer,
  TransferError,
} from '@/lib/console/live/invite-types';

import type { BackendError } from './envelope';

/**
 * 控制台邀请页的后端接口：把 sub2api 原有邀请返利接口的结果换成浏览器用的形状。纯函数，单测锁住。
 * 后端接口不改（技术设计 18.7）。
 */

export const AFFILIATE_PATH = '/user/aff';
export const AFFILIATE_TRANSFER_PATH = '/user/aff/transfer';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function toInvitee(raw: Record<string, unknown>): AffiliateInvitee | null {
  if (!isNumber(raw.user_id)) return null;
  const joined = typeof raw.created_at === 'string' ? Date.parse(raw.created_at) : Number.NaN;
  return {
    id: String(raw.user_id),
    email: text(raw.email),
    username: text(raw.username),
    joinedAt: Number.isNaN(joined) ? null : joined,
    rebateUsd: isNumber(raw.total_rebate) ? raw.total_rebate : 0,
  };
}

/** 后端 data → 邀请详情；缺了邀请码或任何一个金额、人数时返回 null */
export function toAffiliateDetail(raw: unknown): AffiliateDetail | null {
  if (!isRecord(raw) || typeof raw.aff_code !== 'string' || raw.aff_code === '') return null;
  const numbers = [
    raw.aff_count,
    raw.aff_quota,
    raw.aff_frozen_quota,
    raw.aff_history_quota,
    raw.effective_rebate_rate_percent,
  ];
  if (!numbers.every(isNumber)) return null;
  const invitees = Array.isArray(raw.invitees)
    ? raw.invitees
        .filter(isRecord)
        .map(toInvitee)
        .filter((invitee): invitee is AffiliateInvitee => invitee !== null)
    : [];
  return {
    code: raw.aff_code,
    ratePercent: raw.effective_rebate_rate_percent as number,
    invited: raw.aff_count as number,
    availableUsd: raw.aff_quota as number,
    frozenUsd: raw.aff_frozen_quota as number,
    totalUsd: raw.aff_history_quota as number,
    invitees,
  };
}

/** 后端转入结果 → 转了多少、转完的余额 */
export function toAffiliateTransfer(raw: unknown): AffiliateTransfer | null {
  if (!isRecord(raw) || !isNumber(raw.transferred_quota) || !isNumber(raw.balance)) return null;
  return { transferredUsd: raw.transferred_quota, balanceUsd: raw.balance };
}

/** 后端转入错误 → 页面按原因显示的提示 */
export function transferErrorFor(error: BackendError): TransferError {
  if (error.reason === 'AFFILIATE_QUOTA_EMPTY') return 'empty';
  return error.status === 429 ? 'too_many' : 'unavailable';
}
