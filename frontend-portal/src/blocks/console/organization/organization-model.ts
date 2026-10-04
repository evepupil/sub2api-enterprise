import {
  beijingLocalToIso,
  isValidRequestRange,
  parseAmount,
  parsePeriodDays,
} from '@/lib/console/live/org-rules';
import type {
  MemberUpdate,
  OrgMember,
  PeriodicQuotaInput,
  QuotaRequestMode,
  QuotaRequestPolicy,
} from '@/lib/console/live/org-types';

/**
 * 组织页的表单规则（纯函数，不碰界面），照 sub2api 原来的组织页：
 * 成员配额三种方式（不限额、固定累计上限、周期配额）、周期配额的生效时间、配额申请的金额范围。
 * 界面文字不在这里，错误只返回代码。
 */

/** 成员的额度方式 */
export type QuotaMode = 'unlimited' | 'fixed' | 'periodic';

/** 周期配额的草稿：输入框原文；startAt 是北京时间的「YYYY-MM-DDTHH:mm」 */
export interface PeriodicDraft {
  amount: string;
  periodDays: string;
  /** 立即生效：当场开新的一期 */
  immediate: boolean;
  startAt: string;
}

export interface QuotaDraft extends PeriodicDraft {
  mode: QuotaMode;
}

export type PeriodicError = 'amount' | 'period' | 'start';

export const EMPTY_PERIODIC: PeriodicDraft = {
  amount: '',
  periodDays: '',
  immediate: true,
  startAt: '',
};

/** 成员现在的额度 → 设置配额弹窗的初始草稿 */
export function quotaDraftOf(member: OrgMember): QuotaDraft {
  if (member.quota) {
    return {
      mode: 'periodic',
      amount: String(member.quota.amount),
      periodDays: String(member.quota.periodDays),
      immediate: true,
      startAt: '',
    };
  }
  if (member.spendingLimit === null) return { mode: 'unlimited', ...EMPTY_PERIODIC };
  return { mode: 'fixed', ...EMPTY_PERIODIC, amount: String(member.spendingLimit) };
}

/** 周期配额草稿 → 请求；不合法时返回出错的那一项 */
export function parsePeriodic(draft: PeriodicDraft): PeriodicQuotaInput | PeriodicError {
  const amount = parseAmount(draft.amount);
  if (amount === null) return 'amount';
  const periodDays = parsePeriodDays(draft.periodDays);
  if (periodDays === null) return 'period';
  if (draft.immediate) return { amount, periodDays, startAt: null };
  const startAt = beijingLocalToIso(draft.startAt);
  return startAt === null ? 'start' : { amount, periodDays, startAt };
}

/**
 * 设置配额草稿 → 改成员的请求：不限额、固定累计上限走「消费上限」（后端会顺带清掉周期配额），
 * 周期配额走「周期配额」。固定上限可以填 0（不让这个成员消费）。
 */
export function quotaUpdateOf(draft: QuotaDraft): MemberUpdate | PeriodicError {
  if (draft.mode === 'unlimited') return { kind: 'limit', spendingLimit: null };
  if (draft.mode === 'fixed') {
    const amount = parseAmount(draft.amount);
    return amount === null ? 'amount' : { kind: 'limit', spendingLimit: amount };
  }
  const quota = parsePeriodic(draft);
  return typeof quota === 'string' ? quota : { kind: 'quota', quota };
}

/** 配额申请策略的草稿 → 请求；关闭时不要金额范围；范围不对时返回 'range' */
export function policyOf(
  mode: QuotaRequestMode,
  min: string,
  max: string,
): QuotaRequestPolicy | 'range' {
  if (mode === 'off') return { mode, minAmount: null, maxAmount: null };
  const minAmount = parseAmount(min);
  const maxAmount = parseAmount(max);
  return isValidRequestRange(minAmount, maxAmount) ? { mode, minAmount, maxAmount } : 'range';
}

/** 成员在页面上的名字：有组织内名称用名称，否则用邮箱 */
export function memberLabel(member: Pick<OrgMember, 'displayName' | 'email'>): string {
  return member.displayName.trim() || member.email;
}

/** 剩余额度用完了（不限额的不算） */
export function isExhausted(member: Pick<OrgMember, 'spendingRemaining'>): boolean {
  return member.spendingRemaining !== null && member.spendingRemaining <= 0;
}
