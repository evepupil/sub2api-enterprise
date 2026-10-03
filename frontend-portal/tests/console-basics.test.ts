import { describe, expect, it } from 'vitest';

import {
  addDays,
  customRange,
  dayKey,
  dayStart,
  formatCompact,
  formatDateTime,
  formatDayLabel,
  formatDuration,
  formatMonthTitle,
  formatPercent,
  formatSignedUsd,
  formatUsd,
  maskEmail,
  monthMatrix,
  pageButtons,
  paginate,
  presetRange,
  rangeDays,
  TODAY,
  weekdayIndex,
} from '@/lib/console';

describe('控制台时间（北京时间，固定的现在）', () => {
  it('今天是 2026-10-03，时间按 UTC+8 显示', () => {
    expect(TODAY).toBe('2026-10-03');
    expect(formatDateTime(dayStart('2026-10-03') + 3_600_000 * 14 + 32 * 60_000)).toBe(
      '2026-10-03 14:32:00',
    );
    expect(dayKey(dayStart('2026-09-30') + 23.9 * 3_600_000)).toBe('2026-09-30');
  });

  it('日期加减跨月与星期', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekdayIndex('2026-10-03')).toBe(5); // 周六
    expect(weekdayIndex('2026-09-28')).toBe(0); // 周一
  });

  it('预设范围', () => {
    expect(presetRange('today')).toEqual({ preset: 'today', from: TODAY, to: TODAY });
    expect(presetRange('yesterday')).toEqual({
      preset: 'yesterday',
      from: '2026-10-02',
      to: '2026-10-02',
    });
    expect(rangeDays(presetRange('last7d'))).toHaveLength(7);
    expect(rangeDays(presetRange('last30d'))).toHaveLength(30);
    expect(presetRange('thisMonth').from).toBe('2026-10-01');
    expect(presetRange('all').from).toBe('2026-04-12');
  });

  it('自定义范围不分先后，结束日不晚于今天', () => {
    expect(customRange('2026-09-20', '2026-09-10')).toEqual({
      preset: null,
      from: '2026-09-10',
      to: '2026-09-20',
    });
    expect(customRange('2026-09-28', '2026-10-15').to).toBe(TODAY);
  });

  it('月历 6 行 7 列，周一开头', () => {
    const rows = monthMatrix(2026, 9);
    expect(rows).toHaveLength(6);
    expect(rows[0]?.[0]).toEqual({ day: '2026-08-31', inMonth: false });
    expect(rows[0]?.[1]).toEqual({ day: '2026-09-01', inMonth: true });
  });

  it('日期与月份标签', () => {
    expect(formatDayLabel('2026-10-03', 'zh')).toBe('10月3日');
    expect(formatDayLabel('2026-10-03', 'en')).toBe('Oct 3');
    expect(formatMonthTitle(2026, 9, 'zh')).toBe('2026年9月');
    expect(formatMonthTitle(2026, 9, 'en')).toBe('September 2026');
  });
});

describe('控制台数字格式', () => {
  it('紧凑数字', () => {
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(4970)).toBe('4.97K');
    expect(formatCompact(120_000)).toBe('120K');
    expect(formatCompact(999_995)).toBe('1M');
    expect(formatCompact(1_250_000)).toBe('1.25M');
    expect(formatCompact(909_564_219)).toBe('909.6M');
    expect(formatCompact(3.4e9)).toBe('3.4B');
  });

  it('美元金额按大小取精度', () => {
    expect(formatUsd(1284.523)).toBe('$1,284.52');
    expect(formatUsd(0.0412)).toBe('$0.0412');
    expect(formatUsd(0.002117)).toBe('$0.002117');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(-12.3)).toBe('-$12.30');
    expect(formatSignedUsd(100)).toBe('+$100.00');
    expect(formatSignedUsd(-1.5)).toBe('-$1.50');
  });

  it('耗时、百分比、邮箱打码', () => {
    expect(formatDuration(820)).toBe('820 ms');
    expect(formatDuration(3540)).toBe('3.54 s');
    expect(formatDuration(126_000)).toBe('2.1 min');
    expect(formatPercent(0.873)).toBe('87.3%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(1, 0)).toBe('100%');
    expect(maskEmail('zhangwei@gmail.com')).toBe('z***@gmail.com');
  });
});

describe('分页', () => {
  it('切片与页码夹取', () => {
    const items = Array.from({ length: 45 }, (_, i) => i);
    expect(paginate(items, 1, 20).items).toHaveLength(20);
    expect(paginate(items, 3, 20)).toMatchObject({ page: 3, pages: 3, total: 45 });
    expect(paginate(items, 3, 20).items).toEqual([40, 41, 42, 43, 44]);
    expect(paginate(items, 9, 20).page).toBe(3);
    expect(paginate([], 1, 20)).toMatchObject({ page: 1, pages: 1, total: 0 });
  });

  it('页码按钮带省略号', () => {
    expect(pageButtons(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageButtons(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(pageButtons(1, 12)).toEqual([1, 2, 3, 4, 5, 'gap', 12]);
    expect(pageButtons(12, 12)).toEqual([1, 'gap', 8, 9, 10, 11, 12]);
  });
});
