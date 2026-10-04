import { USAGE_MAX_RANGE_DAYS } from '@/lib/console/live/usage-types';
import { daysBetween } from '@/lib/console/time';

/**
 * 控制台各接口共用的日期范围校验：浏览器传来的 ?from=YYYY-MM-DD&to=YYYY-MM-DD。
 * 日期按北京时间划分，传给后端时固定带这个时区。纯函数，单测锁住。
 */

export const CONSOLE_TIMEZONE = 'Asia/Shanghai';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 是不是真实存在的日期（2026-02-30 不算） */
export function isDateKey(value: string | null): value is string {
  if (value === null || !DATE_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** 取起止日期：不合法、起止颠倒或超过最长范围（和后端按天的上限一致）时返回 null */
export function parseDateRange(params: URLSearchParams): { from: string; to: string } | null {
  const from = params.get('from');
  const to = params.get('to');
  if (!isDateKey(from) || !isDateKey(to) || from > to) return null;
  if (daysBetween(from, to) + 1 > USAGE_MAX_RANGE_DAYS) return null;
  return { from, to };
}
