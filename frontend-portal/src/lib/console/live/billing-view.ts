import { addDays, type DateRange } from '../time';

import type { BalanceSummary, LedgerQuery } from './billing-types';

/**
 * 账单页（接后端）的纯计算：日均与可用天数、余额偏低的判断、交易记录的月份切换与查询身份。单测锁住。
 */

/** 余额低于这个数，或者按日均消耗撑不过 LOW_RUNWAY_DAYS 天，余额卡顶部出提示条 */
export const LOW_BALANCE_USD = 1;
export const LOW_RUNWAY_DAYS = 3;

export interface BalanceOutlook {
  /** 最近一段时间（后端给的天数，默认 30 天）的日均消耗 */
  dailyAvgUsd: number;
  /** 按日均消耗还能用几天（向下取整）；最近没有消耗时为 null */
  runwayDays: number | null;
}

export function balanceOutlook(summary: BalanceSummary): BalanceOutlook {
  const days = Math.max(summary.recentDays, 1);
  const dailyAvgUsd = summary.recentConsumedUsd / days;
  if (dailyAvgUsd <= 0) return { dailyAvgUsd: 0, runwayDays: null };
  return { dailyAvgUsd, runwayDays: Math.max(0, Math.floor(summary.balanceUsd / dailyAvgUsd)) };
}

export function isLowBalance(summary: BalanceSummary): boolean {
  if (summary.balanceUsd < LOW_BALANCE_USD) return true;
  const { runwayDays } = balanceOutlook(summary);
  return runwayDays !== null && runwayDays < LOW_RUNWAY_DAYS;
}

export interface YearMonth {
  year: number;
  month: number;
}

/** YYYY-MM-DD 所在的年月 */
export function yearMonthOf(day: string): YearMonth {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
}

/** 往前或往后挪几个月 */
export function shiftYearMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 某个月的日期范围；结束日不晚于今天（本月只到今天） */
export function monthRangeOf({ year, month }: YearMonth, today: string): DateRange {
  const next = shiftYearMonth({ year, month }, 1);
  const last = addDays(`${next.year}-${pad(next.month)}-01`, -1);
  return { preset: null, from: `${year}-${pad(month)}-01`, to: last > today ? today : last };
}

/** 是不是今天所在的月份或更晚（这时「下一月」不能点） */
export function isCurrentOrLaterMonth({ year, month }: YearMonth, today: string): boolean {
  const current = yearMonthOf(today);
  return year * 12 + month >= current.year * 12 + current.month;
}

/** 金额输入框里的文字 → 非负数字；没填、不是数字或为负时返回 null（这一边不限） */
export function parseAmountFilter(textValue: string): number | null {
  if (textValue.trim() === '') return null;
  const value = Number(textValue);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** 最小、最大填反了就对调，不让一次手误变成「没有结果」 */
export function amountRange(
  minText: string,
  maxText: string,
): { min: number | null; max: number | null } {
  const min = parseAmountFilter(minText);
  const max = parseAmountFilter(maxText);
  return min !== null && max !== null && min > max ? { min: max, max: min } : { min, max };
}

/** 交易记录查询的身份：任何一项变了就重新取 */
export function ledgerQueryKey(query: LedgerQuery): string {
  return [
    query.page,
    query.pageSize,
    query.type ?? '',
    query.source ?? '',
    query.query,
    query.minUsd ?? '',
    query.maxUsd ?? '',
    query.from ?? '',
    query.to ?? '',
  ].join('|');
}
