import { addDays, dayKey, isSingleDay, rangeDays, type DateRange } from '../time';
import {
  heatmapStart,
  rankSeries,
  type DayTotal,
  type UsageBreakdown,
  type UsageBucket,
  type UsageMetric,
  type UsageSummary,
} from '../usage';
import {
  USAGE_MAX_RANGE_DAYS,
  type UsageOverviewBucket,
  type UsageOverviewPoint,
  type UsageOverviewSummary,
} from './usage-types';

/**
 * 后端用量数据 → 用量页各区块要的形状。纯函数，单测锁住。
 * 数字卡、热力图、明细图沿用占位数据时的类型与组件，只是数据来源换成后端。
 */

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 数字卡的汇总。卡片上「输入 · 缓存 · 输出」三项加起来等于总 token：
 * 输入 = 没命中缓存的输入 + 写入缓存的输入，缓存 = 命中缓存的输入。
 * 请求数是计费成功的请求；成功率 = 成功 ÷（成功 + 失败），拿不到失败数或没有请求时为 null。
 */
export function summaryFromOverview(s: UsageOverviewSummary): UsageSummary {
  const input = s.inputTokens + s.cacheCreationTokens;
  const inputAll = input + s.cacheReadTokens;
  const attempts = s.failedRequests === null ? 0 : s.requests + s.failedRequests;
  return {
    requests: s.requests,
    failed: s.failedRequests ?? 0,
    successRate: s.failedRequests === null || attempts === 0 ? null : s.requests / attempts,
    inputTokens: input,
    cacheTokens: s.cacheReadTokens,
    outputTokens: s.outputTokens,
    totalTokens: s.totalTokens,
    cacheHitRate: inputAll === 0 ? 0 : s.cacheReadTokens / inputAll,
    images: 0,
    avgLatencyMs: s.avgLatencyMs,
    avgTtftMs: s.avgFirstTokenMs > 0 ? s.avgFirstTokenMs : null,
    costUsd: s.costUsd,
  };
}

/** 时间段合计 → 每天合计（热力图与活跃统计用）；按小时的时间段并到当天 */
export function dailyTotalsFromBuckets(
  buckets: readonly UsageOverviewBucket[],
): Map<string, DayTotal> {
  const totals = new Map<string, DayTotal>();
  for (const bucket of buckets) {
    const day = bucket.bucket.slice(0, 10);
    const current = totals.get(day) ?? { tokens: 0, requests: 0, costUsd: 0 };
    current.tokens += bucket.tokens;
    current.requests += bucket.requests;
    current.costUsd += bucket.costUsd;
    totals.set(day, current);
  }
  return totals;
}

/** 合并几份每天合计，同一天以后面的为准（所选范围的数据覆盖一年热力图里的同一天） */
export function mergeDailyTotals(
  ...sources: readonly ReadonlyMap<string, DayTotal>[]
): Map<string, DayTotal> {
  const merged = new Map<string, DayTotal>();
  for (const source of sources) for (const [day, total] of source) merged.set(day, total);
  return merged;
}

function metricOf(point: UsageOverviewBucket, metric: UsageMetric): number {
  if (metric === 'tokens') return point.tokens;
  if (metric === 'requests') return point.requests;
  return point.costUsd;
}

/**
 * 明细图数据：范围只有一天时按 24 小时出柱子，否则按天；系列按合计从大到小排，
 * 超过 maxSeries 个时排在后面的合并成「其他」。时间段的写法与后端一致（天 YYYY-MM-DD，小时 YYYY-MM-DD HH:00）。
 */
export function breakdownFromPoints(
  points: readonly UsageOverviewPoint[],
  range: DateRange,
  metric: UsageMetric,
  maxSeries = 5,
): UsageBreakdown {
  const buckets: UsageBucket[] = isSingleDay(range)
    ? Array.from({ length: 24 }, (_, hour) => ({
        key: `${range.from} ${pad(hour)}:00`,
        day: range.from,
        hour,
      }))
    : rangeDays(range).map((day) => ({ key: day, day, hour: null }));
  const indexOf = new Map(buckets.map((bucket, index) => [bucket.key, index]));

  const sums = new Map<string, number[]>();
  for (const point of points) {
    const index = indexOf.get(point.bucket);
    if (index === undefined) continue;
    let values = sums.get(point.id);
    if (!values) {
      values = buckets.map(() => 0);
      sums.set(point.id, values);
    }
    values[index] = (values[index] ?? 0) + metricOf(point, metric);
  }
  return rankSeries(buckets, sums, maxSeries);
}

/** 系列 ID → 后端给的名字（同一个系列取第一个非空的名字） */
export function seriesNames(points: readonly UsageOverviewPoint[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const point of points) {
    if (point.name && !names.has(point.id)) names.set(point.id, point.name);
  }
  return names;
}

/**
 * 「全部」时间从哪天算起：账号创建那天（北京时间）。不早于后端允许的最长范围，不晚于今天；
 * 不知道创建时间时看最近一年。
 */
export function usageSince(createdAt: string | null, today: string): string {
  const earliest = addDays(today, -(USAGE_MAX_RANGE_DAYS - 1));
  const created = createdAt === null ? Number.NaN : Date.parse(createdAt);
  if (Number.isNaN(created)) return addDays(today, -364);
  const day = dayKey(created);
  if (day < earliest) return earliest;
  return day > today ? today : day;
}

/** 热力图要取的天数：最早那周的周一到今天 */
export function heatmapRange(today: string): { from: string; to: string } {
  return { from: heatmapStart(today), to: today };
}
