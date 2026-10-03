import { describe, expect, it } from 'vitest';

import {
  breakdownFromPoints,
  dailyTotalsFromBuckets,
  heatmapRange,
  mergeDailyTotals,
  seriesNames,
  summaryFromOverview,
  usageSince,
} from '@/lib/console/live/usage-view';
import type { UsageOverviewPoint, UsageOverviewSummary } from '@/lib/console/live/usage-types';
import {
  customRange,
  liveClockSnapshot,
  parseLiveClock,
  presetRange,
  weekdayIndex,
  type DateRange,
} from '@/lib/console/time';
import { OTHER_SERIES } from '@/lib/console/usage';
import {
  parseUsageQuery,
  toUsageOverview,
  usageOverviewPath,
} from '@/lib/server/sub2api/usage-overview';

const summary = (patch: Partial<UsageOverviewSummary> = {}): UsageOverviewSummary => ({
  requests: 84,
  inputTokens: 500,
  outputTokens: 200,
  cacheCreationTokens: 100,
  cacheReadTokens: 200,
  totalTokens: 1000,
  costUsd: 15.0864,
  avgLatencyMs: 4810.5,
  avgFirstTokenMs: 0,
  failedRequests: 0,
  ...patch,
});

const point = (
  bucket: string,
  id: string,
  requests: number,
  tokens = requests * 100,
  costUsd = requests / 10,
): UsageOverviewPoint => ({ bucket, id, name: id, requests, tokens, costUsd });

const range = (from: string, to: string): DateRange => ({ preset: null, from, to });

describe('数字卡汇总', () => {
  it('输入含写入缓存的部分，缓存是命中缓存的部分，三项加起来等于总 token', () => {
    const result = summaryFromOverview(summary());
    expect(result.inputTokens).toBe(600);
    expect(result.cacheTokens).toBe(200);
    expect(result.inputTokens + result.cacheTokens + result.outputTokens).toBe(result.totalTokens);
    expect(result.cacheHitRate).toBeCloseTo(0.25);
    expect(result.costUsd).toBe(15.0864);
  });

  it('成功率 = 成功 ÷（成功 + 失败）；拿不到失败数或没有请求时不显示', () => {
    expect(summaryFromOverview(summary({ requests: 99, failedRequests: 1 })).successRate).toBe(
      0.99,
    );
    expect(summaryFromOverview(summary({ failedRequests: null })).successRate).toBeNull();
    expect(summaryFromOverview(summary({ requests: 0, failedRequests: 0 })).successRate).toBeNull();
  });

  it('没有记录首字耗时的请求时不显示首字', () => {
    expect(summaryFromOverview(summary()).avgTtftMs).toBeNull();
    expect(summaryFromOverview(summary({ avgFirstTokenMs: 820 })).avgTtftMs).toBe(820);
  });
});

describe('每天合计', () => {
  it('按小时的时间段并到当天，按天的原样', () => {
    const totals = dailyTotalsFromBuckets([
      { bucket: '2026-09-27 10:00', requests: 2, tokens: 300, costUsd: 0.5 },
      { bucket: '2026-09-27 11:00', requests: 1, tokens: 100, costUsd: 0.25 },
      { bucket: '2026-09-28', requests: 4, tokens: 50, costUsd: 1 },
    ]);
    expect(totals.get('2026-09-27')).toEqual({ requests: 3, tokens: 400, costUsd: 0.75 });
    expect(totals.get('2026-09-28')).toEqual({ requests: 4, tokens: 50, costUsd: 1 });
  });

  it('合并时同一天以后面的为准', () => {
    const year = new Map([['2026-09-27', { requests: 1, tokens: 1, costUsd: 1 }]]);
    const latest = new Map([['2026-09-27', { requests: 2, tokens: 2, costUsd: 2 }]]);
    expect(mergeDailyTotals(year, latest).get('2026-09-27')?.requests).toBe(2);
  });
});

describe('明细图', () => {
  it('多天按天出柱子，没有用量的天是 0', () => {
    const data = breakdownFromPoints(
      [point('2026-09-14', 'gpt-5.4', 3), point('2026-09-16', 'gpt-5.4', 1)],
      range('2026-09-14', '2026-09-16'),
      'requests',
    );
    expect(data.buckets.map((bucket) => bucket.key)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
    ]);
    expect(data.series).toEqual([{ id: 'gpt-5.4', total: 4, values: [3, 0, 1] }]);
    expect(data.totals).toEqual([3, 0, 1]);
  });

  it('一天按 24 小时出柱子，时间段写法和后端一致', () => {
    const data = breakdownFromPoints(
      [point('2026-09-27 10:00', 'gpt-5.4', 2)],
      range('2026-09-27', '2026-09-27'),
      'tokens',
    );
    expect(data.buckets).toHaveLength(24);
    expect(data.buckets[10]).toEqual({ key: '2026-09-27 10:00', day: '2026-09-27', hour: 10 });
    expect(data.totals[10]).toBe(200);
  });

  it('超过 5 个系列时按指标排前 4，其余合成「其他」；换指标排名跟着变', () => {
    const points = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) =>
      point('2026-09-14', id, index + 1, 100 * (6 - index)),
    );
    const twoDays = range('2026-09-14', '2026-09-15');
    const byRequests = breakdownFromPoints(points, twoDays, 'requests');
    expect(byRequests.series.map((series) => series.id)).toEqual([
      'f',
      'e',
      'd',
      'c',
      OTHER_SERIES,
    ]);
    expect(byRequests.series.at(-1)?.total).toBe(1 + 2);
    const byTokens = breakdownFromPoints(points, twoDays, 'tokens');
    expect(byTokens.series.map((series) => series.id)).toEqual(['a', 'b', 'c', 'd', OTHER_SERIES]);
  });

  it('范围以外的时间段不计入', () => {
    const data = breakdownFromPoints(
      [point('2026-09-13', 'gpt-5.4', 5)],
      range('2026-09-14', '2026-09-15'),
      'requests',
    );
    expect(data.series).toEqual([]);
  });

  it('系列名取第一个非空的名字', () => {
    const names = seriesNames([
      { ...point('2026-09-14', '2', 1), name: '' },
      { ...point('2026-09-15', '2', 1), name: 'prod' },
    ]);
    expect(names.get('2')).toBe('prod');
  });
});

describe('时间范围', () => {
  it('预设范围可以按真实的今天和账号创建日算，默认仍是占位日期', () => {
    expect(presetRange('last7d', '2026-11-20')).toEqual({
      preset: 'last7d',
      from: '2026-11-14',
      to: '2026-11-20',
    });
    expect(presetRange('all', '2026-11-20', '2026-10-01').from).toBe('2026-10-01');
    expect(presetRange('all', '2026-11-20', '2026-12-01').from).toBe('2026-11-20');
    expect(customRange('2026-11-10', '2026-12-31', '2026-11-20').to).toBe('2026-11-20');
  });

  it('「全部」从账号创建那天（北京时间）算起，最长 1100 天，不知道就看一年', () => {
    expect(usageSince('2026-09-13T20:00:00Z', '2026-10-03')).toBe('2026-09-14');
    expect(usageSince('2020-01-01T00:00:00Z', '2026-10-03')).toBe('2023-09-30');
    expect(usageSince(null, '2026-10-03')).toBe('2025-10-04');
    expect(usageSince('2027-01-01T00:00:00Z', '2026-10-03')).toBe('2026-10-03');
  });

  it('热力图从 53 周前那周的周一取到今天', () => {
    const { from, to } = heatmapRange('2026-10-03');
    expect(to).toBe('2026-10-03');
    expect(weekdayIndex(from)).toBe(0);
    expect(from).toBe('2025-09-29');
  });

  it('真实时间的快照按北京时间，同一小时内不变', () => {
    const at = Date.UTC(2026, 9, 3, 15, 5); // 北京时间 23:05
    expect(liveClockSnapshot(at)).toBe('2026-10-03|23');
    expect(parseLiveClock(liveClockSnapshot(at + 60_000))).toEqual({
      today: '2026-10-03',
      hour: 23,
    });
    expect(liveClockSnapshot(Date.UTC(2026, 9, 3, 16, 0))).toBe('2026-10-04|0');
  });
});

describe('官网用量接口的参数与后端结果', () => {
  it('日期要合法、起止不颠倒、不超过 1100 天', () => {
    const query = (search: string) => parseUsageQuery(new URLSearchParams(search));
    expect(query('from=2026-09-01&to=2026-09-30&detail=1')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      detail: true,
    });
    expect(query('from=2026-09-01&to=2026-09-30')?.detail).toBe(false);
    expect(query('from=2026-02-30&to=2026-03-01')).toBeNull();
    expect(query('from=2026-09-30&to=2026-09-01')).toBeNull();
    expect(query('from=2023-01-01&to=2026-09-30')).toBeNull();
    expect(query('to=2026-09-30')).toBeNull();
  });

  it('一天按小时取，多天按天取；要明细时带三个拆分维度', () => {
    const hourly = new URL(
      `http://x${usageOverviewPath({ from: '2026-09-27', to: '2026-09-27', detail: true })}`,
    );
    expect(hourly.pathname).toBe('/usage/dashboard/overview');
    expect(hourly.searchParams.get('granularity')).toBe('hour');
    expect(hourly.searchParams.get('timezone')).toBe('Asia/Shanghai');
    expect(hourly.searchParams.get('dimensions')).toBe('model,api_key,group');
    const daily = new URL(
      `http://x${usageOverviewPath({ from: '2025-09-29', to: '2026-10-03', detail: false })}`,
    );
    expect(daily.searchParams.get('granularity')).toBe('day');
    expect(daily.searchParams.has('dimensions')).toBe(false);
  });

  it('后端字段换成驼峰；失败数拿不到是 null；密钥、通道 ID 转成字符串', () => {
    const overview = toUsageOverview({
      start_date: '2026-09-01',
      end_date: '2026-09-30',
      granularity: 'day',
      summary: {
        requests: 84,
        actual_cost: 15.0864,
        average_first_token_ms: 0,
        failed_requests: null,
      },
      buckets: [{ bucket: '2026-09-14', requests: 6, total_tokens: 235686, actual_cost: 1.6392 }],
      models: [
        {
          bucket: '2026-09-14',
          id: 0,
          name: 'gpt-5.4',
          requests: 6,
          total_tokens: 1,
          actual_cost: 1,
        },
        { bucket: '2026-09-14', id: 0, name: '', requests: 1, total_tokens: 1, actual_cost: 1 },
      ],
      api_keys: [
        { bucket: '2026-09-14', id: 2, name: 'prod', requests: 6, total_tokens: 1, actual_cost: 1 },
      ],
      groups: [
        { bucket: '2026-09-14', id: 0, name: '', requests: 6, total_tokens: 1, actual_cost: 1 },
      ],
    });
    expect(overview?.summary).toMatchObject({
      requests: 84,
      costUsd: 15.0864,
      failedRequests: null,
    });
    expect(overview?.buckets).toEqual([
      { bucket: '2026-09-14', requests: 6, tokens: 235686, costUsd: 1.6392 },
    ]);
    expect(overview?.series.model.map((p) => p.id)).toEqual(['gpt-5.4']);
    expect(overview?.series.key[0]).toMatchObject({ id: '2', name: 'prod' });
    expect(overview?.series.group[0]?.id).toBe('0');
    expect(toUsageOverview({ summary: {} })).toBeNull();
  });
});
