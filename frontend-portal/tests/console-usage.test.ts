import { describe, expect, it } from 'vitest';

import {
  activityStats,
  heatmap,
  heatmapStart,
  monthlyRunRate,
  OTHER_SERIES,
  rankSeries,
  type DayTotal,
  type UsageBucket,
} from '@/lib/console';

const day = (tokens: number, costUsd = tokens / 1000): DayTotal => ({
  tokens,
  requests: tokens > 0 ? 1 : 0,
  costUsd,
});

describe('明细图', () => {
  const buckets: UsageBucket[] = ['2026-10-01', '2026-10-02'].map((key) => ({
    key,
    day: key,
    hour: null,
  }));

  it('超过上限的系列按合计从大到小排，排在后面的合并为「其他」，每根柱子的合计不变', () => {
    const sums = new Map<string, number[]>([
      ['a', [5, 5]],
      ['b', [4, 4]],
      ['c', [3, 3]],
      ['d', [2, 2]],
      ['e', [1, 1]],
      ['f', [0, 2]],
    ]);
    const result = rankSeries(buckets, sums, 5);
    expect(result.series.map((series) => series.id)).toEqual(['a', 'b', 'c', 'd', OTHER_SERIES]);
    expect(result.series.at(-1)).toMatchObject({ values: [1, 3], total: 4 });
    expect(result.totals).toEqual([15, 17]);
  });

  it('没超过上限时原样保留（合计一样时按编号排）', () => {
    const sums = new Map<string, number[]>([
      ['y', [1, 0]],
      ['x', [0, 1]],
    ]);
    expect(rankSeries(buckets, sums).series.map((series) => series.id)).toEqual(['x', 'y']);
  });
});

describe('活跃热力图与统计', () => {
  const totals = new Map<string, DayTotal>([
    ['2026-09-28', day(100)],
    ['2026-09-29', day(300)],
    ['2026-09-30', day(0)],
    ['2026-10-01', day(200)],
    ['2026-10-02', day(800)],
    ['2026-10-03', day(400)],
  ]);

  it('最早那周从周一开始，53 周 × 7 天，最后一列今天之后为空白', () => {
    expect(heatmapStart('2026-10-07')).toBe('2025-10-06');
    const map = heatmap(totals, '2026-10-07');
    expect(map.weeks).toHaveLength(53);
    expect(map.weeks.every((week) => week.length === 7)).toBe(true);
    const lastWeek = map.weeks.at(-1) ?? [];
    expect(lastWeek[0]?.day).toBe('2026-10-05');
    expect(lastWeek[2]?.day).toBe('2026-10-07');
    expect(lastWeek[3]).toMatchObject({ future: true, level: 0 });
  });

  it('按有用量的天的四分位分 4 档，最多的一天最深', () => {
    const cells = heatmap(totals, '2026-10-07').weeks.flat();
    const level = (key: string) => cells.find((cell) => cell.day === key)?.level;
    expect(level('2026-09-30')).toBe(0);
    expect(level('2026-09-28')).toBe(1);
    expect(level('2026-10-02')).toBe(4);
  });

  it('活跃天数、最长连续、最活跃的一天与花费', () => {
    const stats = activityStats(totals, { preset: null, from: '2026-09-28', to: '2026-10-03' });
    expect(stats).toMatchObject({ activeDays: 5, longestStreak: 3 });
    expect(stats.mostActive).toEqual({ day: '2026-10-02', tokens: 800, costUsd: 0.8 });
    expect(stats.costUsd).toBeCloseTo(1.8, 6);
  });

  it('月花费折算', () => {
    expect(monthlyRunRate(60, 15)).toBe(120);
    expect(monthlyRunRate(10, 0)).toBe(0);
  });
});
