import type { OrgInvitation, OrgInvitationStatus } from './org-types';

/**
 * 组织页的输入规则与几个小计算，表单和官网服务器共用。规则照后端：
 * 成员名称 1–50 个字；金额不能是负数；周期 1–3650 天；申请理由、审批备注最多 500 个字；
 * 申请的单次最低要大于 0、最高不低于最低。纯函数，单测锁住。
 */

export const MEMBER_NAME_MAX = 50;
export const PERIOD_DAYS_MAX = 3650;
/** 申请理由、审批备注的长度上限 */
export const NOTE_MAX = 500;
/** 金额上限，防止手滑多打几个零 */
export const AMOUNT_MAX = 1_000_000;

/** 创建邀请码时可选的有效期（天），0 是长期有效 */
export const INVITATION_VALIDITY_DAYS = [1, 7, 30, 0] as const;
export type InvitationValidity = (typeof INVITATION_VALIDITY_DAYS)[number];

const DAY_MS = 86_400_000;

/** 按字算长度（中文、emoji 都算一个），和后端一致 */
const charLength = (text: string) => Array.from(text).length;

export function memberNameError(name: string): 'required' | 'tooLong' | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'required';
  return charLength(trimmed) > MEMBER_NAME_MAX ? 'tooLong' : null;
}

/** 申请理由、审批备注是否太长 */
export function noteTooLong(text: string): boolean {
  return charLength(text.trim()) > NOTE_MAX;
}

/** 金额是否可用：不是负数、不超过上限的有限数 */
export function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= AMOUNT_MAX;
}

/** 输入框里的金额：空着、不是数字、负数或太大时返回 null */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return isValidAmount(value) ? value : null;
}

export function isValidPeriodDays(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= PERIOD_DAYS_MAX
  );
}

/** 输入框里的周期天数：1–3650 的整数，否则 null */
export function parsePeriodDays(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return isValidPeriodDays(value) ? value : null;
}

/**
 * 成员申请额度时填的金额：空着、不是大于 0 的数 → 'amount'；不在管理员设的单次最低、最高之间 → 'range'。
 */
export function requestAmountError(
  text: string,
  min: number | null,
  max: number | null,
): 'amount' | 'range' | null {
  const amount = parseAmount(text);
  if (amount === null || amount <= 0) return 'amount';
  if ((min !== null && amount < min) || (max !== null && amount > max)) return 'range';
  return null;
}

/** 申请的单次最低、最高：最低大于 0，最高不低于最低 */
export function isValidRequestRange(min: number | null, max: number | null): boolean {
  return min !== null && max !== null && min > 0 && max >= min && isValidAmount(max);
}

/** 北京时间的「YYYY-MM-DDTHH:mm」→ 带时区的时间（给后端）；格式不对返回 null */
export function beijingLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const iso = `${local}:00+08:00`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** 有效期 → 到期时间（ISO）；0 是长期有效（null） */
export function invitationExpiry(days: InvitationValidity, nowMs: number): string | null {
  return days === 0 ? null : new Date(nowMs + days * DAY_MS).toISOString();
}

/** 页面上显示的状态：还没用但已过了有效期的，算「已过期」 */
export function invitationStatus(invitation: OrgInvitation, nowMs: number): OrgInvitationStatus {
  if (
    invitation.status === 'unused' &&
    invitation.expiresAt !== null &&
    Date.parse(invitation.expiresAt) <= nowMs
  ) {
    return 'expired';
  }
  return invitation.status;
}

/** 邀请链接：官网注册页，邀请码已经填好（和 sub2api 原来的链接写法一样） */
export function inviteLink(origin: string, code: string): string {
  return `${origin}/register?invitation_code=${encodeURIComponent(code)}`;
}

/** 金额按 1e-8 为单位换成整数（和后端的计费精度一致），避免浮点误差 */
const SCALE = 8;
const SCALE_FACTOR = BigInt(10) ** BigInt(SCALE);

function toUnits(amount: number): bigint {
  const [integerPart = '0', fractionPart = '0'] = amount.toFixed(SCALE).split('.');
  return BigInt(integerPart) * SCALE_FACTOR + BigInt(fractionPart);
}

function fromUnits(units: bigint): number {
  const integerPart = units / SCALE_FACTOR;
  const fractionPart = (units % SCALE_FACTOR).toString().padStart(SCALE, '0');
  return Number(`${integerPart}.${fractionPart}`);
}

/**
 * 平分上限的预览：总额按人数平分，除不尽的最小单位依次补给 ID 小的成员，
 * 各人之和正好等于总额（和后端的分法一致，最终以后端结果为准）。
 */
export function splitAmounts(userIds: readonly number[], total: number): Map<number, number> {
  const ids = [...new Set(userIds.filter((id) => Number.isSafeInteger(id) && id > 0))].sort(
    (a, b) => a - b,
  );
  const shares = new Map<number, number>();
  if (ids.length === 0 || !isValidAmount(total)) return shares;
  const units = toUnits(total);
  const count = BigInt(ids.length);
  const base = units / count;
  const extra = units % count;
  ids.forEach((id, index) => {
    shares.set(id, fromUnits(BigInt(index) < extra ? base + BigInt(1) : base));
  });
  return shares;
}
