import { addDays, rangeDays, TODAY, weekdayIndex, type DateRange } from './time';

/**
 * 用量页的图表计算：明细图合并「其他」、活跃热力图与活跃统计、月花费折算，以及几个共用类型。
 * 数据来自后端的用量总览（见 ./live/usage-view.ts）；早期的占位用量记录 2026-10-08 删掉了。
 */

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

export type UsageMetric = 'tokens' | 'requests' | 'cost';
export const USAGE_METRICS: readonly UsageMetric[] = ['tokens', 'requests', 'cost'];

export type UsageDimension = 'model' | 'key' | 'group';

export interface UsageSummary {
  requests: number;
  failed: number;
  /** 成功率 0–1；拿不到失败数时为 null，界面不显示 */
  successRate: number | null;
  inputTokens: number;
  cacheTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** 缓存命中率 = 缓存读取 ÷（未命中输入 + 缓存读取） */
  cacheHitRate: number;
  images: number;
  avgLatencyMs: number;
  /** 文本请求的平均首字耗时；没有记录首字耗时的请求时为 null，界面不显示 */
  avgTtftMs: number | null;
  costUsd: number;
}

export interface UsageBucket {
  /** 天：YYYY-MM-DD；小时：YYYY-MM-DDTHH */
  key: string;
  day: string;
  hour: number | null;
}

export interface UsageSeries {
  /** 模型调用名 / 密钥 id / 分组 id；合并后的其余部分为 'other' */
  id: string;
  total: number;
  values: number[];
}

export interface UsageBreakdown {
  buckets: UsageBucket[];
  series: UsageSeries[];
  /** 每个柱子的合计 */
  totals: number[];
}

export const OTHER_SERIES = 'other';

/**
 * 把各系列按合计从大到小排，超过 maxSeries 个时把排在后面的合并成「其他」，再算出每个柱子的合计。
 * sums 里每个系列的数组和 buckets 一一对应。
 */
export function rankSeries(
  buckets: UsageBucket[],
  sums: ReadonlyMap<string, number[]>,
  maxSeries = 5,
): UsageBreakdown {
  const all = [...sums.entries()]
    .map(([id, values]) => ({ id, values, total: values.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
  let series = all;
  if (all.length > maxSeries) {
    const kept = all.slice(0, maxSeries - 1);
    const rest = all.slice(maxSeries - 1);
    const values = buckets.map((_, i) => rest.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
    series = [...kept, { id: OTHER_SERIES, values, total: values.reduce((a, b) => a + b, 0) }];
  }
  const totals = buckets.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  return { buckets, series, totals };
}

export interface DayTotal {
  tokens: number;
  requests: number;
  costUsd: number;
}

export interface ActivityStats {
  activeDays: number;
  longestStreak: number;
  mostActive: { day: string; tokens: number; costUsd: number } | null;
  costUsd: number;
}

/** 范围内的活跃天数、最长连续活跃天数、最活跃的一天与总花费 */
export function activityStats(
  totals: ReadonlyMap<string, DayTotal>,
  range: DateRange,
): ActivityStats {
  let activeDays = 0;
  let streak = 0;
  let longestStreak = 0;
  let mostActive: ActivityStats['mostActive'] = null;
  let costUsd = 0;
  for (const day of rangeDays(range)) {
    const total = totals.get(day);
    if (!total || total.requests === 0) {
      streak = 0;
      continue;
    }
    activeDays += 1;
    streak += 1;
    longestStreak = Math.max(longestStreak, streak);
    costUsd += total.costUsd;
    if (!mostActive || total.tokens > mostActive.tokens) {
      mostActive = { day, tokens: total.tokens, costUsd: total.costUsd };
    }
  }
  return { activeDays, longestStreak, mostActive, costUsd: round6(costUsd) };
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  day: string;
  level: HeatLevel;
  tokens: number;
  costUsd: number;
  /** 晚于今天的格子（最后一列补位），画成空白 */
  future: boolean;
}

export interface Heatmap {
  /** 每列一周（周一到周日），从早到晚 */
  weeks: HeatCell[][];
  /** 月份标签所在的列 */
  months: { week: number; month: number }[];
}

/** 热力图第一列（最早那周的周一）：要看的天数从这一天到 endDay */
export function heatmapStart(endDay: string = TODAY, weekCount = 53): string {
  const lastMonday = addDays(endDay, -weekdayIndex(endDay));
  return addDays(lastMonday, -(weekCount - 1) * 7);
}

/** 活跃热力图：最近 weekCount 周，按非零天的四分位分 4 档深浅 */
export function heatmap(
  totals: ReadonlyMap<string, DayTotal>,
  endDay: string = TODAY,
  weekCount = 53,
): Heatmap {
  const firstMonday = heatmapStart(endDay, weekCount);

  const nonZero: number[] = [];
  for (let day = firstMonday; day <= endDay; day = addDays(day, 1)) {
    const tokens = totals.get(day)?.tokens ?? 0;
    if (tokens > 0) nonZero.push(tokens);
  }
  nonZero.sort((a, b) => a - b);
  const quantile = (q: number) => nonZero[Math.floor((nonZero.length - 1) * q)] ?? 0;
  const [q1, q2, q3] = [quantile(0.25), quantile(0.5), quantile(0.75)];
  const levelOf = (tokens: number): HeatLevel =>
    tokens <= 0 ? 0 : tokens <= q1 ? 1 : tokens <= q2 ? 2 : tokens <= q3 ? 3 : 4;

  const weeks: HeatCell[][] = [];
  const months: Heatmap['months'] = [];
  let previousMonth = -1;
  for (let w = 0; w < weekCount; w++) {
    const monday = addDays(firstMonday, w * 7);
    const week: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(monday, d);
      const total = totals.get(day);
      const future = day > endDay;
      const tokens = future ? 0 : (total?.tokens ?? 0);
      week.push({ day, level: levelOf(tokens), tokens, costUsd: total?.costUsd ?? 0, future });
    }
    weeks.push(week);
    // 月份标签放在该月第一个周一所在的列；第一列不标，避免和第二个标签挤在一起
    const month = Number(monday.slice(5, 7));
    if (month !== previousMonth && w > 0 && Number(monday.slice(8, 10)) <= 7) {
      months.push({ week: w, month });
    }
    previousMonth = month;
  }
  return { weeks, months };
}

/** 按日均折算的月花费 */
export function monthlyRunRate(costUsd: number, days: number): number {
  return days > 0 ? round6((costUsd / days) * 30) : 0;
}

export interface KeyUsage {
  last30: { requests: number; costUsd: number };
  today: { requests: number; costUsd: number };
  totalCostUsd: number;
}
