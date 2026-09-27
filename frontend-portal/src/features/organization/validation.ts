/**
 * 组织成员、邀请与额度的纯校验与载荷构造（无网络、无副作用、与渲染无关）。
 *
 * 契约来源：src/features/organization/types.ts（主控冻结）与
 * design/team-and-delivery.md「页面 14：组织与成员」。
 *
 * 边界：
 * - 金额一律走 parseQuotaAmount：非负、有限、十进制最多 8 位小数；
 *   空字符串不猜成 0，positive 选项要求严格大于 0。
 * - 静态上限只有显式勾选「不限额」才是 null，数字 0 不会被改写成 null。
 * - 周期天数只接受 1..3650 的整数；指定生效日期只接受未来日历日期，
 *   按浏览器本地 00:00 转 ISO；立即生效不提交 start_at，交给后端取当前时刻。
 * - 任何非法输入一律抛中文 OrganizationInputError，不静默改写成其它值。
 */

import { OrganizationInputError } from './errors';
import type {
  DefaultQuotaDraft,
  OrganizationInvitation,
  OrganizationMember,
  QuotaDraft,
} from './types';

/** 静态上限或周期金额：最多 8 位小数的十进制文本，不接受符号、指数与千分位。 */
const DECIMAL_PATTERN = /^[0-9]+(?:\.[0-9]{1,8})?$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const POSITIVE_INTEGER_PATTERN = /^[0-9]+$/;
/** 周期天数上限与后端 QuotaMaxPeriodDays 保持一致。 */
const MAX_PERIOD_DAYS = 3650;
/** 组织内显示名称的 Unicode 码点长度上限。 */
const MAX_DISPLAY_NAME_POINTS = 50;

export interface StaticMemberQuotaPayload {
  kind: 'static';
  body: { spending_limit: number | null };
}

export interface PeriodicMemberQuotaPayload {
  kind: 'periodic';
  body: { quota: { amount: number; period_days: number; start_at?: string } | null };
}

export type MemberQuotaPayload = StaticMemberQuotaPayload | PeriodicMemberQuotaPayload;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** 本地日历日序号，用来比较两个时刻是否落在同一天（本地时区）。 */
function localDateKey(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * 把 `YYYY-MM-DD` 按浏览器本地 00:00 解释成 ISO 字符串，且必须是未来的日历日期。
 * 组件必须真实存在（拒绝 2026-02-30 这类会被 Date 静默滚动的日期）。
 */
function futureDateToIso(value: string, now: Date = new Date()): string {
  const text = value.trim();
  const match = DATE_ONLY_PATTERN.exec(text);
  if (match === null) {
    throw new OrganizationInputError('日期格式不正确，请选择日期');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new OrganizationInputError('日期格式不正确，请选择日期');
  }
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new OrganizationInputError('日期不是有效日期');
  }
  if (date.getTime() <= now.getTime()) {
    throw new OrganizationInputError('日期必须是未来的日期');
  }
  return date.toISOString();
}

/**
 * 金额文本转数字：非负、有限、十进制最多 8 位。
 * positive 为 true 时要求严格大于 0（用于「申请/发放金额」这类必须为正的输入）。
 */
export function parseQuotaAmount(value: string, options: { positive?: boolean } = {}): number {
  const text = value.trim();
  if (text === '') {
    throw new OrganizationInputError('金额不能为空');
  }
  if (!DECIMAL_PATTERN.test(text)) {
    throw new OrganizationInputError('金额必须是不超过 8 位小数的非负十进制数字');
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new OrganizationInputError('金额超出可表示范围');
  }
  if (options.positive === true && parsed <= 0) {
    throw new OrganizationInputError('金额必须大于 0');
  }
  return parsed;
}

/** 周期天数：1..3650 的正整数，空字符串与小数一律拒绝。 */
function parsePeriodDays(value: string): number {
  const text = value.trim();
  if (!POSITIVE_INTEGER_PATTERN.test(text)) {
    throw new OrganizationInputError(`周期天数必须是 1 到 ${MAX_PERIOD_DAYS} 之间的整数`);
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_PERIOD_DAYS) {
    throw new OrganizationInputError(`周期天数必须是 1 到 ${MAX_PERIOD_DAYS} 之间的整数`);
  }
  return parsed;
}

/** 组织内显示名称：trim 后按 Unicode 码点计 1..50，返回清洗后的值。 */
export function validateDisplayName(value: string): string {
  const trimmed = value.trim();
  const points = Array.from(trimmed).length;
  if (points < 1) {
    throw new OrganizationInputError('成员名称不能为空');
  }
  if (points > MAX_DISPLAY_NAME_POINTS) {
    throw new OrganizationInputError(`成员名称不能超过 ${MAX_DISPLAY_NAME_POINTS} 个字符`);
  }
  return trimmed;
}

/** 周期锚点严格晚于今天时才回填日期；否则按「立即生效」处理，避免默认值非法。 */
function localDateIfFuture(iso: string): string | null {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const date = new Date(timestamp);
  if (localDateKey(date) <= localDateKey(new Date())) {
    return null;
  }
  return formatLocalDate(date);
}

/**
 * 成员现状转额度草稿：
 * - 无周期配置时用静态模式；上限为 null 表示不限额，0 保留为 0。
 * - 有周期配置时用周期模式，回填金额、天数；锚点在未来日历日期时回填日期，
 *   否则用「立即生效」，避免打开弹窗就悄悄改成过去日期。
 */
export function createQuotaDraft(member?: OrganizationMember): QuotaDraft {
  if (member === undefined || member.quota === null) {
    const limit = member?.limit;
    const hasLimit = typeof limit === 'number';
    return {
      mode: 'static',
      unlimited: member !== undefined && limit === null,
      amount: hasLimit ? String(limit) : '',
      periodDays: '',
      starts: 'now',
      startDate: '',
    };
  }
  const startDate = localDateIfFuture(member.quota.startAt);
  return {
    mode: 'periodic',
    unlimited: false,
    amount: String(member.quota.amount),
    periodDays: String(member.quota.periodDays),
    starts: startDate === null ? 'now' : 'date',
    startDate: startDate ?? '',
  };
}

/**
 * 构造成员额度请求体。
 * - static：只提交 spending_limit；勾选不限额才是 null，数字 0 保持 0。
 * - periodic：提交 quota；勾选不限额表示取消周期（quota: null），
 *   否则提交金额、天数与可选 start_at（立即生效时不提交）。
 */
export function buildMemberQuotaPayload(
  draft: QuotaDraft,
  now: Date = new Date(),
): MemberQuotaPayload {
  if (draft.mode === 'static') {
    const spendingLimit = draft.unlimited ? null : parseQuotaAmount(draft.amount);
    return { kind: 'static', body: { spending_limit: spendingLimit } };
  }
  if (draft.unlimited) {
    return { kind: 'periodic', body: { quota: null } };
  }
  const quota: { amount: number; period_days: number; start_at?: string } = {
    amount: parseQuotaAmount(draft.amount),
    period_days: parsePeriodDays(draft.periodDays),
  };
  if (draft.starts === 'date') {
    quota.start_at = futureDateToIso(draft.startDate, now);
  }
  return { kind: 'periodic', body: { quota } };
}

/**
 * 构造默认周期配额请求体。
 * 关闭时不提交 amount / period_days（后端会清空），两个同步开关强制 false：
 * 关闭默认额度就不存在「同步存量成员」的业务语义，不允许顺带覆盖成员。
 */
export function buildDefaultQuotaPayload(draft: DefaultQuotaDraft): Record<string, unknown> {
  if (!draft.enabled) {
    return { enabled: false, sync_unconfigured: false, sync_configured: false };
  }
  return {
    enabled: true,
    amount: parseQuotaAmount(draft.amount),
    period_days: parsePeriodDays(draft.periodDays),
    sync_unconfigured: draft.syncUnconfigured,
    sync_configured: draft.syncConfigured,
  };
}

/**
 * 邀请码展示状态：后端只给 unused/used/disabled；
 * 未使用且已到期时派生成 expired，不伪造后端状态；其余归 unknown。
 */
export function invitationStatus(
  record: OrganizationInvitation,
  now: Date = new Date(),
): 'unused' | 'used' | 'disabled' | 'expired' | 'unknown' {
  if (record.status === 'used') {
    return 'used';
  }
  if (record.status === 'disabled') {
    return 'disabled';
  }
  if (record.status === 'unused') {
    if (record.expiresAt !== null && Date.parse(record.expiresAt) <= now.getTime()) {
      return 'expired';
    }
    return 'unused';
  }
  return 'unknown';
}

/** 成员展示名：displayName、username、email、编号依次兜底。 */
export function memberLabel(member: OrganizationMember): string {
  const displayName = member.displayName.trim();
  if (displayName !== '') {
    return displayName;
  }
  const username = member.username.trim();
  if (username !== '') {
    return username;
  }
  const email = member.email.trim();
  if (email !== '') {
    return email;
  }
  return `#${member.userId}`;
}
