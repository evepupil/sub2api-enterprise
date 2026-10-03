import type { AppLocale } from '@/i18n/routing';

/**
 * 控制台的时间工具。所有时间按北京时间（UTC+8）计算和显示，
 * 「现在」固定为 2026-10-03 14:32（与模型目录的日期一致），构建与浏览器算出的结果相同。
 * 日期一律用「日期键」YYYY-MM-DD 表示，字符串比较即可判断先后。
 */

export const TZ_OFFSET_MS = 8 * 3_600_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** 固定的「现在」：北京时间 2026-10-03 14:32:00 */
export const CONSOLE_NOW = Date.UTC(2026, 9, 3, 14, 32) - TZ_OFFSET_MS;

/** 账号开通日（占位），用量与流水从这一天开始 */
export const ACCOUNT_SINCE = '2026-04-12';

const pad = (n: number) => String(n).padStart(2, '0');

function shifted(ts: number): Date {
  return new Date(ts + TZ_OFFSET_MS);
}

/** 时间戳 → 日期键（北京时间） */
export function dayKey(ts: number): string {
  const d = shifted(ts);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 日期键当天 0 点（北京时间）的时间戳 */
export function dayStart(key: string): number {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const d = Number(key.slice(8, 10));
  return Date.UTC(y, m - 1, d) - TZ_OFFSET_MS;
}

export function addDays(key: string, n: number): string {
  return dayKey(dayStart(key) + n * DAY_MS);
}

/** 两个日期键相差的天数（b - a） */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayStart(b) - dayStart(a)) / DAY_MS);
}

/** 星期：0 = 周一 … 6 = 周日 */
export function weekdayIndex(key: string): number {
  return (shifted(dayStart(key)).getUTCDay() + 6) % 7;
}

/** 北京时间的小时（0–23） */
export function hourOf(ts: number): number {
  return shifted(ts).getUTCHours();
}

export const TODAY = dayKey(CONSOLE_NOW);

/**
 * 真实的「现在」（北京时间）：接了后端的页面用它，占位页面仍用固定的 TODAY。
 * 返回「日期键|小时」这样的字符串，同一小时内不变，可以直接给 useSyncExternalStore 当快照。
 */
export function liveClockSnapshot(now: number = Date.now()): string {
  return `${dayKey(now)}|${hourOf(now)}`;
}

export interface LiveClock {
  today: string;
  /** 北京时间的小时（0–23） */
  hour: number;
}

export function parseLiveClock(snapshot: string): LiveClock {
  const [today = TODAY, hour = '0'] = snapshot.split('|');
  return { today, hour: Number(hour) };
}

/** 今天已经过去的比例（0–1），用来让「今天」的数据只算到现在 */
export const TODAY_ELAPSED = (CONSOLE_NOW - dayStart(TODAY)) / DAY_MS;

/** 2026-10-03 14:32:08 */
export function formatDateTime(ts: number): string {
  const d = shifted(ts);
  return `${dayKey(ts)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** 2026-10-03 14:32 */
export function formatDateTimeShort(ts: number): string {
  return formatDateTime(ts).slice(0, 16);
}

const EN_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const EN_MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** 月份短名：9月 / Sep */
export function formatMonthLabel(month: number, locale: AppLocale): string {
  return locale === 'zh' ? `${month}月` : (EN_MONTHS[month - 1] ?? String(month));
}

/** 日期标签：10月3日 / Oct 3 */
export function formatDayLabel(key: string, locale: AppLocale): string {
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  return locale === 'zh' ? `${month}月${day}日` : `${formatMonthLabel(month, 'en')} ${day}`;
}

/** 月份标题：2026年9月 / September 2026 */
export function formatMonthTitle(year: number, month: number, locale: AppLocale): string {
  return locale === 'zh' ? `${year}年${month}月` : `${EN_MONTHS_LONG[month - 1] ?? month} ${year}`;
}

/** 小时标签：14:00 */
export function formatHour(hour: number): string {
  return `${pad(hour)}:00`;
}

export type RangePreset = 'today' | 'yesterday' | 'last7d' | 'last30d' | 'thisMonth' | 'all';

export const RANGE_PRESETS: readonly RangePreset[] = [
  'today',
  'yesterday',
  'last7d',
  'last30d',
  'thisMonth',
  'all',
];

/** 日期范围（含首尾两天）。preset 为 null 表示自定义 */
export interface DateRange {
  preset: RangePreset | null;
  from: string;
  to: string;
}

/**
 * 预设范围。today 与 since（「全部」的起点，账号开通日）默认是占位数据用的固定日期，
 * 接了后端的页面传入真实的今天和账号创建日。
 */
export function presetRange(
  preset: RangePreset,
  today: string = TODAY,
  since: string = ACCOUNT_SINCE,
): DateRange {
  switch (preset) {
    case 'today':
      return { preset, from: today, to: today };
    case 'yesterday': {
      const day = addDays(today, -1);
      return { preset, from: day, to: day };
    }
    case 'last7d':
      return { preset, from: addDays(today, -6), to: today };
    case 'last30d':
      return { preset, from: addDays(today, -29), to: today };
    case 'thisMonth':
      return { preset, from: `${today.slice(0, 7)}-01`, to: today };
    case 'all':
      return { preset, from: since < today ? since : today, to: today };
  }
}

/** 自定义范围：两端不分先后，结束日不晚于今天 */
export function customRange(a: string, b: string, today: string = TODAY): DateRange {
  const [from, to] = a <= b ? [a, b] : [b, a];
  return { preset: null, from, to: to > today ? today : to };
}

export const DEFAULT_RANGE = presetRange('last30d');

export function inRange(day: string, range: DateRange): boolean {
  return day >= range.from && day <= range.to;
}

/** 范围内的每一天（日期键） */
export function rangeDays(range: DateRange): string[] {
  const days: string[] = [];
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** 只有一天时按小时出图 */
export function isSingleDay(range: DateRange): boolean {
  return range.from === range.to;
}

export interface CalendarCell {
  day: string;
  /** 是否属于当前显示的月份 */
  inMonth: boolean;
}

/** 月历：6 行 × 7 列（周一开头），包含前后月补位的日期 */
export function monthMatrix(year: number, month: number): CalendarCell[][] {
  const first = `${year}-${pad(month)}-01`;
  const start = addDays(first, -weekdayIndex(first));
  const rows: CalendarCell[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: CalendarCell[] = [];
    for (let c = 0; c < 7; c++) {
      const day = addDays(start, r * 7 + c);
      row.push({ day, inMonth: day.slice(0, 7) === first.slice(0, 7) });
    }
    rows.push(row);
  }
  return rows;
}
