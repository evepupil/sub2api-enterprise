import type { TimeWindow } from '@/lib/console/live/models-types';

/** 后端的时段字段 → 时段（模型广场的分组高峰、分时段价，密钥页能选的分组的高峰共用）。纯函数，单测锁住。 */

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** 20:00:00 → 20:00（后端有时带秒） */
const clock = (value: string): string => value.replace(/^(\d{2}:\d{2}):00$/, '$1');

/** 开始、结束、倍率：缺任何一项时 null */
export function toTimeWindow(start: unknown, end: unknown, multiplier: unknown): TimeWindow | null {
  if (typeof start !== 'string' || typeof end !== 'string' || !start || !end) return null;
  if (!isNumber(multiplier)) return null;
  return { start: clock(start), end: clock(end), multiplier };
}
