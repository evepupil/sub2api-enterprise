/**
 * M3 按天日期范围纯规则测试（Vitest，Node 环境）。
 *
 * 契约来源：.fleet/briefs/m23-dates.md、docs/模块设计/用量统计.md、time-range-corrected.txt。
 * 只断言日期规则本身：八预选的首末日、含今天、周一开始、跨月/跨年、闰年、
 * 时区与夏令时日历日、同一 instant 在不同时区的日期、非法输入拒绝、
 * toCalendarDate/fromCalendarDate 回环不产生 UTC 偏移。
 *
 * 事实：
 * - DateRange 是 YYYY-MM-DD（含首末日）+ timeZone，没有时分，也没有「近24小时」。
 * - 近 N 天是含今天的 N 个自然日，绝不是 N*24 小时；日历运算不得按 24 小时减本地时刻。
 * - 预选：today / yesterday / last7 / last14 / last30 / thisWeek / thisMonth / lastMonth。
 * - thisWeek 是本周一至今天；thisMonth 是本月 1 日至今天；lastMonth 是上月首末。
 * - 非法 timeZone / 非法 now 由 getPresetRange 抛异常；isValidDateRange 非法返回 false 不抛。
 * - toCalendarDate 用本地年月日构造（Calendar 组件语义），fromCalendarDate 读本地年月日，
 *   不得用 toISOString（会差一天）。
 */
import { describe, expect, it } from 'vitest';

import {
  formatDateRange,
  fromCalendarDate,
  getPresetRange,
  isValidDateRange,
  toCalendarDate,
} from '../src/lib/time/date-range';
import type { DatePreset, DateRange } from '../src/features/usage/types';

const SH = 'Asia/Shanghai';

function expectRange(actual: DateRange, start: string, end: string, timeZone = SH): void {
  expect({ start: actual.start, end: actual.end, timeZone: actual.timeZone }).toEqual({
    start,
    end,
    timeZone,
  });
}

/** 含首末日的自然日个数，按 UTC 零点算，与任何本地时区无关。 */
function calendarDayCount(range: DateRange): number {
  const start = Date.parse(`${range.start}T00:00:00Z`);
  const end = Date.parse(`${range.end}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

describe('八预选的具体首末日', () => {
  // 2026-09-27 是周日；Asia/Shanghai 下今天是 2026-09-27。
  const now = new Date('2026-09-27T03:00:00Z');

  it.each<[DatePreset, string, string]>([
    ['today', '2026-09-27', '2026-09-27'],
    ['yesterday', '2026-09-26', '2026-09-26'],
    ['last7', '2026-09-21', '2026-09-27'],
    ['last14', '2026-09-14', '2026-09-27'],
    ['last30', '2026-08-29', '2026-09-27'],
    ['thisWeek', '2026-09-21', '2026-09-27'],
    ['thisMonth', '2026-09-01', '2026-09-27'],
    ['lastMonth', '2026-08-01', '2026-08-31'],
  ])('%s 的首末日是 %s ~ %s', (preset, start, end) => {
    expectRange(getPresetRange(preset, now, SH), start, end);
  });

  it('范围是 YYYY-MM-DD 字符串，不含任何时分或小时语义', () => {
    for (const preset of [
      'today',
      'yesterday',
      'last7',
      'last14',
      'last30',
      'thisWeek',
      'thisMonth',
      'lastMonth',
    ] as const) {
      const range = getPresetRange(preset, now, SH);
      expect(range.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.timeZone).toBe(SH);
    }
  });

  it('不接受 last24 这种滚动小时预选', () => {
    expect(() => getPresetRange('last24' as DatePreset, now, SH)).toThrow();
  });
});

describe('近 N 天含今天且是 N 个自然日', () => {
  const now = new Date('2026-09-27T03:00:00Z');

  it.each([
    ['last7', 7, '2026-09-21'],
    ['last14', 14, '2026-09-14'],
    ['last30', 30, '2026-08-29'],
  ] as const)('%s 恰好含今天在内共 %i 个自然日', (preset, days, start) => {
    const range = getPresetRange(preset, now, SH);
    expect(range.end).toBe('2026-09-27');
    expect(range.start).toBe(start);
    expect(calendarDayCount(range)).toBe(days);
  });

  it('今天的日期就是 end，不因当天时刻不同而变化', () => {
    const morning = getPresetRange('last7', new Date('2026-09-27T00:00:01Z'), SH);
    const night = getPresetRange('last7', new Date('2026-09-27T15:59:00Z'), SH);
    expectRange(morning, '2026-09-21', '2026-09-27');
    expectRange(night, '2026-09-21', '2026-09-27');
  });
});

describe('本周从周一开始', () => {
  it('周日当天属于以周一开头的那一周', () => {
    // 2026-09-27 是周日。
    expectRange(
      getPresetRange('thisWeek', new Date('2026-09-27T03:00:00Z'), SH),
      '2026-09-21',
      '2026-09-27',
    );
  });

  it('周中时起点仍是周一', () => {
    // 2026-09-23 是周三。
    expectRange(
      getPresetRange('thisWeek', new Date('2026-09-23T03:00:00Z'), SH),
      '2026-09-21',
      '2026-09-23',
    );
  });

  it('起点当天的 UTC 星期一是 1', () => {
    const range = getPresetRange('thisWeek', new Date('2026-09-23T03:00:00Z'), SH);
    expect(new Date(`${range.start}T00:00:00Z`).getUTCDay()).toBe(1);
  });
});

describe('跨月与跨年', () => {
  it('一月初的近 7 天会跨到上一年 12 月', () => {
    // 2026-01-02 是周五。
    const now = new Date('2026-01-02T03:00:00Z');
    expectRange(getPresetRange('last7', now, SH), '2025-12-27', '2026-01-02');
    expect(calendarDayCount(getPresetRange('last7', now, SH))).toBe(7);
  });

  it('一月初的近 30 天会跨到上一年 12 月', () => {
    const now = new Date('2026-01-02T03:00:00Z');
    expectRange(getPresetRange('last30', now, SH), '2025-12-04', '2026-01-02');
  });

  it('一月初的本周起点在上一年 12 月的周一', () => {
    const now = new Date('2026-01-02T03:00:00Z');
    expectRange(getPresetRange('thisWeek', now, SH), '2025-12-29', '2026-01-02');
  });

  it('一月的本月与上月分别落在 1 月和上一年 12 月', () => {
    const now = new Date('2026-01-02T03:00:00Z');
    expectRange(getPresetRange('thisMonth', now, SH), '2026-01-01', '2026-01-02');
    expectRange(getPresetRange('lastMonth', now, SH), '2025-12-01', '2025-12-31');
  });

  it('三月的上月是完整二月', () => {
    const now = new Date('2026-03-10T03:00:00Z');
    expectRange(getPresetRange('lastMonth', now, SH), '2026-02-01', '2026-02-28');
  });

  it('月末当天的本月起点仍是 1 日', () => {
    const now = new Date('2026-08-31T03:00:00Z');
    expectRange(getPresetRange('thisMonth', now, SH), '2026-08-01', '2026-08-31');
  });
});

describe('2024 闰年二月', () => {
  it('闰年二月本身是 29 天', () => {
    const now = new Date('2024-02-29T03:00:00Z');
    expectRange(getPresetRange('thisMonth', now, SH), '2024-02-01', '2024-02-29');
  });

  it('闰年的上月（一月）是 31 天', () => {
    const now = new Date('2024-02-29T03:00:00Z');
    expectRange(getPresetRange('lastMonth', now, SH), '2024-01-01', '2024-01-31');
  });

  it('三月初的上月是闰年 2 月 29 日收尾', () => {
    const now = new Date('2024-03-01T03:00:00Z');
    expectRange(getPresetRange('lastMonth', now, SH), '2024-02-01', '2024-02-29');
  });

  it('闰日当天的近 7 天跨过 2 月', () => {
    const now = new Date('2024-02-29T03:00:00Z');
    expectRange(getPresetRange('last7', now, SH), '2024-02-23', '2024-02-29');
  });

  it('2023 不是闰年，2 月只有 28 天', () => {
    const now = new Date('2023-03-01T03:00:00Z');
    expectRange(getPresetRange('lastMonth', now, SH), '2023-02-01', '2023-02-28');
  });
});

describe('America/New_York 夏令时下的日历日', () => {
  // 2026-03-08 是北美春季夏令时切换日（02:00 EST → 03:00 EDT）。
  // 08:00Z 时纽约已是 04:00 EDT，今天 = 2026-03-08。
  // 按 24 小时硬减会得到 2026-03-01（少一天），日历运算必须得到 2026-03-02。
  it('春季切换日当天，近 7 天仍是含今天的 7 个日历日', () => {
    const range = getPresetRange('last7', new Date('2026-03-08T08:00:00Z'), 'America/New_York');
    expectRange(range, '2026-03-02', '2026-03-08', 'America/New_York');
    expect(calendarDayCount(range)).toBe(7);
  });

  it('春季切换日当天的本周起点是周一 3 月 2 日', () => {
    const range = getPresetRange('thisWeek', new Date('2026-03-08T08:00:00Z'), 'America/New_York');
    expectRange(range, '2026-03-02', '2026-03-08', 'America/New_York');
  });

  it('秋季切换日（2026-11-01）仍是 7 个日历日', () => {
    const range = getPresetRange('last7', new Date('2026-11-01T06:30:00Z'), 'America/New_York');
    expectRange(range, '2026-10-26', '2026-11-01', 'America/New_York');
    expect(calendarDayCount(range)).toBe(7);
  });

  it('跨春季切换的近 14 天不受 24 小时偏移影响', () => {
    const range = getPresetRange('last14', new Date('2026-03-12T16:00:00Z'), 'America/New_York');
    expectRange(range, '2026-02-27', '2026-03-12', 'America/New_York');
    expect(calendarDayCount(range)).toBe(14);
  });
});

describe('同一 instant 在不同时区的日期不同', () => {
  it('Asia/Shanghai 与 UTC 对同一时刻给出不同今天', () => {
    // 2026-09-26T17:30:00Z：上海已是 09-27，UTC 还是 09-26。
    const now = new Date('2026-09-26T17:30:00Z');
    expectRange(
      getPresetRange('today', now, 'Asia/Shanghai'),
      '2026-09-27',
      '2026-09-27',
      'Asia/Shanghai',
    );
    expectRange(getPresetRange('today', now, 'UTC'), '2026-09-26', '2026-09-26', 'UTC');
  });

  it('Asia/Shanghai 与 America/New_York 对同一时刻给出不同今天', () => {
    const now = new Date('2026-09-27T03:00:00Z');
    expectRange(getPresetRange('today', now, 'Asia/Shanghai'), '2026-09-27', '2026-09-27');
    expectRange(
      getPresetRange('today', now, 'America/New_York'),
      '2026-09-26',
      '2026-09-26',
      'America/New_York',
    );
  });
});

describe('非法输入一律拒绝', () => {
  const now = new Date('2026-09-27T03:00:00Z');

  it('getPresetRange 对非法时区抛异常', () => {
    for (const zone of ['Mars/Olympus', '', 'Not/AZone', 'Asia/Shanghai ']) {
      expect(() => getPresetRange('today', now, zone)).toThrow();
    }
  });

  it('getPresetRange 对非法 now 抛异常', () => {
    expect(() => getPresetRange('today', new Date(Number.NaN), SH)).toThrow();
    expect(() => getPresetRange('today', '2026-09-27' as unknown as Date, SH)).toThrow();
  });

  it.each([
    '2024-02-30',
    '2023-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-09-31',
    '2026-1-01',
    '2026-09-1',
    '20260901',
    '2026-09-01T00:00:00Z',
    '2026/09/01',
    '',
  ])('isValidDateRange 拒绝非法日期 %s', (bad) => {
    expect(isValidDateRange({ start: bad, end: '2026-09-30', timeZone: SH })).toBe(false);
    expect(isValidDateRange({ start: '2026-09-01', end: bad, timeZone: SH })).toBe(false);
  });

  it('isValidDateRange 拒绝反序范围', () => {
    expect(isValidDateRange({ start: '2026-09-27', end: '2026-09-21', timeZone: SH })).toBe(false);
  });

  it('isValidDateRange 接受同一天的 start === end', () => {
    expect(isValidDateRange({ start: '2026-09-27', end: '2026-09-27', timeZone: SH })).toBe(true);
  });

  it('isValidDateRange 接受真实存在的闰日', () => {
    expect(isValidDateRange({ start: '2024-02-29', end: '2024-03-01', timeZone: SH })).toBe(true);
  });

  it('isValidDateRange 拒绝非法时区而不抛异常', () => {
    expect(
      isValidDateRange({ start: '2026-09-01', end: '2026-09-30', timeZone: 'Mars/Olympus' }),
    ).toBe(false);
    expect(isValidDateRange({ start: '2026-09-01', end: '2026-09-30', timeZone: '' })).toBe(false);
  });

  it('isValidDateRange 拒绝结构不完整的输入而不抛异常', () => {
    expect(isValidDateRange(null)).toBe(false);
    expect(isValidDateRange(undefined)).toBe(false);
    expect(isValidDateRange('2026-09-01')).toBe(false);
    expect(isValidDateRange({ start: '2026-09-01' })).toBe(false);
    expect(isValidDateRange({ start: '2026-09-01', end: '2026-09-30' })).toBe(false);
    expect(isValidDateRange({ start: 20260901, end: 20260930, timeZone: SH })).toBe(false);
  });
});

describe('toCalendarDate / fromCalendarDate 不产生 UTC 偏移', () => {
  it('toCalendarDate 用本地年月日构造', () => {
    const date = toCalendarDate('2026-01-01');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
    expect(date.getTime()).toBe(new Date(2026, 0, 1).getTime());
  });

  it('fromCalendarDate 读本地年月日，不使用 toISOString', () => {
    // 本地 2026-01-01 00:00 在 UTC+8 下 toISOString 是 2025-12-31，必须返回 2026-01-01。
    expect(fromCalendarDate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(fromCalendarDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it.each(['2024-02-29', '2026-01-01', '2026-09-27', '2026-12-31', '2025-03-01'])(
    '回环 %s 保持不变',
    (value) => {
      expect(fromCalendarDate(toCalendarDate(value))).toBe(value);
    },
  );

  it('toCalendarDate 拒绝非法日期字符串', () => {
    for (const bad of ['2024-02-30', '2023-02-29', '2026-13-01', '2026-09-31', '2026-9-1', '']) {
      expect(() => toCalendarDate(bad)).toThrow();
    }
  });

  it('fromCalendarDate 拒绝非法 Date', () => {
    expect(() => fromCalendarDate(new Date(Number.NaN))).toThrow();
    expect(() => fromCalendarDate('2026-09-27' as unknown as Date)).toThrow();
  });
});

describe('formatDateRange 文案', () => {
  it('是 YYYY-MM-DD — YYYY-MM-DD', () => {
    expect(formatDateRange({ start: '2026-09-20', end: '2026-09-26', timeZone: SH })).toBe(
      '2026-09-20 — 2026-09-26',
    );
  });

  it('非法范围抛异常', () => {
    expect(() =>
      formatDateRange({ start: '2026-09-27', end: '2026-09-20', timeZone: SH }),
    ).toThrow();
    expect(() =>
      formatDateRange({ start: '2024-02-30', end: '2024-03-01', timeZone: SH }),
    ).toThrow();
  });
});
