import type {
  AffiliateDetail,
  AffiliateInvitee,
  AffiliateRules,
} from '@/lib/console/live/invite-types';

/**
 * 控制台邀请页的后端接口：把 sub2api 邀请返利详情换成浏览器用的形状。纯函数，单测锁住。
 * 企业版后端让返利自动进余额（不再有「转入余额」这一步），并带上返利规则的后台设置（技术设计 18.7）。
 */

export const AFFILIATE_PATH = '/user/aff';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** 规则里的后台设置：旧版后端没有这几项、或值不合法时按 0（不冻结、永久有效、不设上限） */
const setting = (value: unknown): number => (isNumber(value) && value > 0 ? value : 0);

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

/** 后端 data → 邀请详情；缺了邀请码或任何一个金额、人数、比例时返回 null */
export function toAffiliateDetail(raw: unknown): AffiliateDetail | null {
  if (!isRecord(raw) || typeof raw.aff_code !== 'string' || raw.aff_code === '') return null;
  const {
    aff_count: invited,
    aff_quota: available,
    aff_frozen_quota: frozen,
    aff_history_quota: total,
    effective_rebate_rate_percent: ratePercent,
  } = raw;
  if (
    !isNumber(invited) ||
    !isNumber(available) ||
    !isNumber(frozen) ||
    !isNumber(total) ||
    !isNumber(ratePercent)
  ) {
    return null;
  }
  const rules: AffiliateRules = {
    ratePercent,
    freezeHours: setting(raw.rebate_freeze_hours),
    durationDays: setting(raw.rebate_duration_days),
    perInviteeCapUsd: setting(raw.rebate_per_invitee_cap),
  };
  const invitees = Array.isArray(raw.invitees)
    ? raw.invitees
        .filter(isRecord)
        .map(toInvitee)
        .filter((invitee): invitee is AffiliateInvitee => invitee !== null)
    : [];
  return {
    code: raw.aff_code,
    rules,
    invited,
    totalUsd: total,
    // 可转的返利会被后端自动转进余额，和冻结中的一样都算「还没进余额」
    pendingUsd: available + frozen,
    invitees,
  };
}
