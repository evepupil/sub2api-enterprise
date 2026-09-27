/**
 * M3 按天日期范围规则（纯函数，服务端与客户端均可用）。
 *
 * 契约来源：src/features/usage/types.ts 的 DateRange / DatePreset。
 *
 * 规则：
 * - 范围按「日」粒度，YYYY-MM-DD 字符串，含首日与末日。
 * - today/yesterday/last7/last14/last30 都含今天；last7 是「今天往前共 7 个
 *   自然日」，绝不是 168 小时；本模块不提供 last24 或任何时分语义。
 * - thisWeek：本周一至今天；thisMonth：本月 1 日至今天；lastMonth：上月首日
 *   至上月末日。
 * - 「今天是几号」用 Intl.DateTimeFormat.formatToParts 按 timeZone 求得；
 *   日历运算（加减天数、月份、闰年）全部用 Date.UTC 完成，避免夏令时切换
 *   或按 24 小时减法导致的日期偏移。
 * - toCalendarDate / fromCalendarDate 用于 react-day-picker 的 Calendar：
 *   Calendar 组件持有本地时区的 Date。fromCalendarDate 读本地 getFullYear/
 *   getMonth/getDate，绝不用 toISOString（UTC 偏移会让日期差一天）。
 * - 所有校验类入口非法一律返回 false，不抛异常；getPresetRange 收到非法
 *   timeZone 或非法 now 则抛出带原因的清晰异常。
 */

import type { DatePreset, DateRange } from '@/features/usage/types';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const DEFAULT_TIME_ZONE = 'Asia/Shanghai';

/** 所有八种预选，顺序即界面展示顺序。 */
export const DATE_PRESETS: readonly DatePreset[] = [
  'today',
  'yesterday',
  'last7',
  'last14',
  'last30',
  'thisWeek',
  'thisMonth',
  'lastMonth',
] as const;

interface Ymd {
  year: number;
  month: number;
  day: number;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** 按目标时区取 y/m/d；timeZone 非法时 Intl 会 throw RangeError，这里换成语义化错误。 */
function ymdInZone(date: Date, timeZone: string): Ymd {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number | undefined => {
    const part = parts.find((p) => p.type === type);
    return part === undefined ? undefined : Number(part.value);
  };
  const year = get('year');
  const month = get('month');
  const day = get('day');
  if (
    year === undefined ||
    Number.isNaN(year) ||
    month === undefined ||
    Number.isNaN(month) ||
    day === undefined ||
    Number.isNaN(day)
  ) {
    throw new RangeError(
      `无法在时区 "${timeZone}" 解析日期：Intl.DateTimeFormat.formatToParts 未返回年/月/日。`,
    );
  }
  return { year, month, day };
}

/** 全 UTC 日历加法：不依赖任何本地时区，无 DST 问题。 */
function addDaysUtc({ year, month, day }: Ymd, days: number): Ymd {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function daysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toIso({ year, month, day }: Ymd): string {
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

/** 严格校验 YYYY-MM-DD（含真实日历：2 月、闰年、月份天数）。 */
function parseIsoDate(value: string): Ymd | null {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonthUtc(year, month)) return null;
  return { year, month, day };
}

/**
 * 八种预选的日期范围（含首末日）：
 * - today：今天；yesterday：昨天。
 * - last7/last14/last30：今天往前共 N 个自然日（含今天），不是 N*24 小时。
 * - thisWeek：本周一至今天；thisMonth：本月 1 日至今天；lastMonth：上月首末。
 */
export function getPresetRange(
  preset: DatePreset,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): DateRange {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') {
    throw new TypeError(
      `非法 timeZone：${String(timeZone)}，应为如 "${DEFAULT_TIME_ZONE}" 的 IANA 时区名。`,
    );
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError(`非法 now：${String(now)}，应为有效 Date。`);
  }
  // 先用非法值探测 timeZone（合法时区对任意时间都能解析，不会误伤）。
  ymdInZone(now, timeZone);

  const today = ymdInZone(now, timeZone);

  switch (preset) {
    case 'today':
      return { start: toIso(today), end: toIso(today), timeZone };
    case 'yesterday': {
      const y = addDaysUtc(today, -1);
      return { start: toIso(y), end: toIso(y), timeZone };
    }
    case 'last7':
    case 'last14':
    case 'last30': {
      const span = preset === 'last7' ? 7 : preset === 'last14' ? 14 : 30;
      const start = addDaysUtc(today, -(span - 1));
      return { start: toIso(start), end: toIso(today), timeZone };
    }
    case 'thisWeek': {
      // Date.UTC 的星期：周日为 0，换算成周一为一周之首。
      const jsWeekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
      const daysSinceMonday = (jsWeekday + 6) % 7;
      const monday = addDaysUtc(today, -daysSinceMonday);
      return { start: toIso(monday), end: toIso(today), timeZone };
    }
    case 'thisMonth':
      return { start: toIso({ ...today, day: 1 }), end: toIso(today), timeZone };
    case 'lastMonth': {
      const ym = new Date(Date.UTC(today.year, today.month - 1 - 1, 1));
      const firstDay = { year: ym.getUTCFullYear(), month: ym.getUTCMonth() + 1, day: 1 };
      return {
        start: toIso(firstDay),
        end: toIso({ ...firstDay, day: daysInMonthUtc(firstDay.year, firstDay.month) }),
        timeZone,
      };
    }
    default:
      throw new TypeError(`非法 preset：${String(preset)}，可选值：${DATE_PRESETS.join(' / ')}。`);
  }
}

/** 严格校验一个 DateRange：两端都是真实存在的 YYYY-MM-DD、时区合法、start <= end。 */
export function isValidDateRange(range: unknown): range is DateRange {
  if (range === null || typeof range !== 'object') return false;
  const candidate = range as Partial<DateRange>;
  if (typeof candidate.start !== 'string' || typeof candidate.end !== 'string') return false;
  if (typeof candidate.timeZone !== 'string' || candidate.timeZone.trim() === '') return false;
  if (parseIsoDate(candidate.start) === null) return false;
  if (parseIsoDate(candidate.end) === null) return false;
  if (candidate.start > candidate.end) return false;
  try {
    // 合法时区对任意时间都能 formatToParts；非法时区（如 "Mars/Olympus"）会 throw。
    new Intl.DateTimeFormat('en-US', { timeZone: candidate.timeZone }).format(0);
  } catch {
    return false;
  }
  return true;
}

/** "2026-09-27" → 本地 Date（Calendar 组件的本地表示），yyyy-02-29 等非法串 throw。 */
export function toCalendarDate(value: string): Date {
  const parsed = parseIsoDate(value);
  if (parsed === null) {
    throw new RangeError(`非法日期字符串：${String(value)}，应为真实存在的 YYYY-MM-DD。`);
  }
  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

/** Calendar 的本地 Date → "YYYY-MM-DD"；读本地年月日，绝不用 toISOString（会偏移一天）。 */
export function fromCalendarDate(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`非法日期对象：${String(value)}，应为有效 Date。`);
  }
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/** "YYYY-MM-DD — YYYY-MM-DD"，用作按钮/标题等展示文案。 */
export function formatDateRange(range: DateRange): string {
  if (!isValidDateRange(range)) {
    throw new TypeError(
      `非法 DateRange：${JSON.stringify(range)}，需要 { start, end, timeZone } 且 start <= end。`,
    );
  }
  return `${range.start} — ${range.end}`;
}

/** 便捷判定：字符串是否为真实存在的 YYYY-MM-DD（含 2 月/闰年规则）。 */
export function isValidDateString(value: string): boolean {
  return parseIsoDate(value) !== null;
}
