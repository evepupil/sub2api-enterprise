import { describe, expect, it } from 'vitest';

import {
  activityStats,
  breakdown,
  dailyTotals,
  heatmap,
  keyUsage,
  monthlyRunRate,
  OTHER_SERIES,
  presetRange,
  recordsInRange,
  summarize,
  USAGE_RECORDS,
} from '@/lib/console';

const last30 = presetRange('last30d');
const records30 = recordsInRange(last30);
const sum30 = summarize(records30);

describe('用量记录（固定种子）', () => {
  it('从开通日到今天，近 30 天花费约 $143', () => {
    expect(USAGE_RECORDS[0]?.day).toBe('2026-04-12');
    expect(USAGE_RECORDS.at(-1)?.day).toBe('2026-10-03');
    expect(sum30.costUsd).toBeCloseTo(142.97, 2);
    expect(sum30.requests).toBe(41198);
  });

  it('汇总：成功率、缓存命中率、总 Token', () => {
    expect(sum30.successRate).toBeGreaterThan(0.99);
    expect(sum30.cacheHitRate).toBeCloseTo(0.62, 2);
    expect(sum30.totalTokens).toBe(sum30.inputTokens + sum30.cacheTokens + sum30.outputTokens);
    expect(summarize([])).toMatchObject({ requests: 0, successRate: 1, costUsd: 0 });
  });

  it('暂停与过期的密钥之后不再有用量', () => {
    expect(USAGE_RECORDS.some((r) => r.keyId === 'key-labeling' && r.day >= '2026-09-10')).toBe(
      false,
    );
    expect(USAGE_RECORDS.some((r) => r.keyId === 'key-legacy' && r.day > '2026-08-31')).toBe(false);
  });
});

describe('明细图', () => {
  it('按天出柱，各系列之和等于汇总', () => {
    const chart = breakdown(records30, last30, 'model', 'cost');
    expect(chart.buckets).toHaveLength(30);
    const total = chart.series.reduce((sum, s) => sum + s.total, 0);
    expect(total).toBeCloseTo(sum30.costUsd, 4);
    expect(chart.totals.reduce((a, b) => a + b, 0)).toBeCloseTo(sum30.costUsd, 4);
    // 系列按合计从大到小
    const totals = chart.series.map((s) => s.total);
    expect([...totals].sort((a, b) => b - a)).toEqual(totals);
  });

  it('超过上限的系列合并为「其他」', () => {
    const chart = breakdown(records30, last30, 'model', 'tokens', 3);
    expect(chart.series).toHaveLength(3);
    expect(chart.series[2]?.id).toBe(OTHER_SERIES);
    expect(chart.series.reduce((sum, s) => sum + s.total, 0)).toBeCloseTo(sum30.totalTokens, 0);
  });

  it('一天的范围按 24 小时出柱，今天只分到现在这一小时', () => {
    const today = presetRange('today');
    const chart = breakdown(recordsInRange(today), today, 'key', 'requests');
    expect(chart.buckets).toHaveLength(24);
    expect(chart.buckets[14]?.hour).toBe(14);
    expect(chart.totals[15]).toBe(0);
    expect(chart.totals.reduce((a, b) => a + b, 0)).toBeCloseTo(
      summarize(recordsInRange(today)).requests,
      6,
    );
  });

  it('按分组拆分只有个人版与专业版', () => {
    const chart = breakdown(records30, last30, 'group', 'requests');
    expect(chart.series.map((s) => s.id).sort()).toEqual(['personal', 'pro']);
  });
});

describe('活跃热力图与统计', () => {
  const totals = dailyTotals();

  it('53 周 × 7 天，最后一列今天之后为空白', () => {
    const map = heatmap(totals);
    expect(map.weeks).toHaveLength(53);
    expect(map.weeks.every((week) => week.length === 7)).toBe(true);
    const lastWeek = map.weeks.at(-1) ?? [];
    expect(lastWeek[5]?.day).toBe('2026-10-03');
    expect(lastWeek[6]?.future).toBe(true);
    expect(lastWeek[6]?.level).toBe(0);
    // 开通之前全是 0 档
    expect(map.weeks[0]?.every((cell) => cell.level === 0)).toBe(true);
    expect(map.months.at(-1)).toEqual({ week: 49, month: 9 });
  });

  it('近 30 天天天活跃；全部时间最长连续 69 天', () => {
    expect(activityStats(totals, last30)).toMatchObject({ activeDays: 30, longestStreak: 30 });
    const all = activityStats(totals, presetRange('all'));
    expect(all.longestStreak).toBe(69);
    expect(all.mostActive?.day).toBe('2026-09-30');
    expect(all.costUsd).toBeCloseTo(summarize(USAGE_RECORDS).costUsd, 4);
  });

  it('月花费折算', () => {
    expect(monthlyRunRate(60, 15)).toBe(120);
    expect(monthlyRunRate(10, 0)).toBe(0);
  });
});

describe('密钥用量', () => {
  it('各密钥近 30 天花费之和等于总花费', () => {
    const ids = ['key-prod', 'key-claude-code', 'key-test', 'key-labeling', 'key-legacy'];
    const total = ids.reduce((sum, id) => sum + keyUsage(id).last30.costUsd, 0);
    expect(total).toBeCloseTo(sum30.costUsd, 4);
    expect(keyUsage('key-legacy').last30.requests).toBe(0);
  });
});
