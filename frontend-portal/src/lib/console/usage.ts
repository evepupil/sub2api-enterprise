import { getModel, imagePrice, textPrice, type EditionId } from '@/lib/catalog';

import { API_KEYS, keyActiveOn, USED_MODEL_IDS, type UsedModelId } from './keys';
import { between, createRandom } from './random';
import {
  ACCOUNT_SINCE,
  addDays,
  CONSOLE_NOW,
  daysBetween,
  hourOf,
  inRange,
  isSingleDay,
  presetRange,
  rangeDays,
  TODAY,
  TODAY_ELAPSED,
  weekdayIndex,
  type DateRange,
} from './time';

/**
 * 用量（占位数据）：从开通日到今天，每天 × 每个密钥 × 每个模型一条汇总记录。
 * 金额按密钥所在通道的价格（官方价 × 通道倍率）算，和官网价目表对得上。
 * 用量页的数字卡、热力图、明细图都从这份记录推出来，彼此一致。
 */
export interface UsageRecord {
  day: string;
  keyId: string;
  modelId: UsedModelId;
  group: EditionId;
  requests: number;
  failed: number;
  /** 未命中缓存的输入 Token */
  inputTokens: number;
  /** 命中缓存读取的输入 Token */
  cacheTokens: number;
  outputTokens: number;
  images: number;
  /** 总耗时合计（毫秒），平均值 = 合计 ÷ 请求数 */
  latencyMs: number;
  /** 首字耗时合计（毫秒），只有文本模型有 */
  ttftMs: number;
  costUsd: number;
}

export interface Profile {
  input: number;
  output: number;
  cacheRatio: number;
  latencyMs: number;
  ttftMs: number;
  failRate: number;
}

/** 每个模型单次请求的典型规模 */
export const PROFILES: Record<UsedModelId, Profile> = {
  'claude-sonnet-5-5': {
    input: 9000,
    output: 650,
    cacheRatio: 0.72,
    latencyMs: 7200,
    ttftMs: 1100,
    failRate: 0.008,
  },
  'gpt-6-sol': {
    input: 3600,
    output: 520,
    cacheRatio: 0.45,
    latencyMs: 5100,
    ttftMs: 820,
    failRate: 0.006,
  },
  'gemini-3.5-flash': {
    input: 2600,
    output: 340,
    cacheRatio: 0.2,
    latencyMs: 2400,
    ttftMs: 480,
    failRate: 0.004,
  },
  'deepseek-v4-pro': {
    input: 3000,
    output: 760,
    cacheRatio: 0.3,
    latencyMs: 8600,
    ttftMs: 1600,
    failRate: 0.012,
  },
  'gpt-image-2': {
    input: 180,
    output: 0,
    cacheRatio: 0,
    latencyMs: 18500,
    ttftMs: 0,
    failRate: 0.02,
  },
};

/** 全账号每天的请求量基数（工作日、增长到顶时） */
const BASE_REQUESTS = 2000;

/** 假期：这几天没有调用，让热力图和「最长连续」有起伏 */
const HOLIDAY = { from: '2026-07-20', to: '2026-07-26' };

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** 按通道价格算一段用量的花费；billableShare 是计费请求的占比（失败请求不计费） */
export function usageCost(
  modelId: UsedModelId,
  group: EditionId,
  usage: { inputTokens: number; cacheTokens: number; outputTokens: number; images: number },
  billableShare: number,
): number {
  const model = getModel(modelId);
  const text = textPrice(model, group);
  if (text) {
    const tokens =
      usage.inputTokens * text.input +
      usage.cacheTokens * text.cacheRead +
      usage.outputTokens * text.output;
    return round6((tokens / 1_000_000) * billableShare);
  }
  const image = imagePrice(model, group);
  if (!image) return 0;
  const perImage = image.kind === 'per-image' ? image.from : image.estimatedPerImage;
  return round6(usage.images * perImage);
}

function generate(): UsageRecord[] {
  const random = createRandom('console-usage');
  const records: UsageRecord[] = [];
  const total = daysBetween(ACCOUNT_SINCE, TODAY);
  for (let i = 0; i <= total; i++) {
    const day = addDays(ACCOUNT_SINCE, i);
    const weekday = weekdayIndex(day);
    const weekFactor = weekday === 5 ? 0.45 : weekday === 6 ? 0.35 : 1;
    const growth = 0.3 + 0.7 * (i / total);
    const noise = between(random, 0.75, 1.25);
    // 开通后头 70 天偶尔整天不用；假期整周不用
    const idle = (i < 70 && random() < 0.12) || (day >= HOLIDAY.from && day <= HOLIDAY.to);
    if (idle) continue;
    const elapsed = day === TODAY ? TODAY_ELAPSED : 1;
    for (const key of API_KEYS) {
      if (!keyActiveOn(key, day)) continue;
      const keyRequests = BASE_REQUESTS * growth * weekFactor * noise * elapsed * key.share;
      for (const modelId of USED_MODEL_IDS) {
        const weight = key.mix[modelId];
        if (weight === undefined) continue;
        const requests = Math.round(keyRequests * weight * between(random, 0.85, 1.15));
        if (requests === 0) continue;
        const p = PROFILES[modelId];
        const failed = Math.min(
          requests,
          Math.round(requests * p.failRate * between(random, 0, 2)),
        );
        const inputAll = Math.round(requests * p.input * between(random, 0.8, 1.2));
        const cacheTokens = Math.round(inputAll * p.cacheRatio);
        const outputTokens = Math.round(requests * p.output * between(random, 0.8, 1.2));
        const isImage = getModel(modelId).type === 'image';
        const usage = {
          inputTokens: inputAll - cacheTokens,
          cacheTokens,
          outputTokens,
          images: isImage ? requests - failed : 0,
        };
        records.push({
          day,
          keyId: key.id,
          modelId,
          group: key.group,
          requests,
          failed,
          ...usage,
          latencyMs: Math.round(requests * p.latencyMs * between(random, 0.85, 1.15)),
          ttftMs: isImage ? 0 : Math.round(requests * p.ttftMs * between(random, 0.85, 1.15)),
          costUsd: usageCost(modelId, key.group, usage, (requests - failed) / requests),
        });
      }
    }
  }
  return records;
}

export const USAGE_RECORDS: readonly UsageRecord[] = generate();

export function recordsInRange(
  range: DateRange,
  records: readonly UsageRecord[] = USAGE_RECORDS,
): UsageRecord[] {
  return records.filter((record) => inRange(record.day, range));
}

export type UsageMetric = 'tokens' | 'requests' | 'cost';
export const USAGE_METRICS: readonly UsageMetric[] = ['tokens', 'requests', 'cost'];

export type UsageDimension = 'model' | 'key' | 'group';

export function totalTokens(record: UsageRecord): number {
  return record.inputTokens + record.cacheTokens + record.outputTokens;
}

export function metricValue(record: UsageRecord, metric: UsageMetric): number {
  if (metric === 'tokens') return totalTokens(record);
  if (metric === 'requests') return record.requests;
  return record.costUsd;
}

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

export function summarize(records: readonly UsageRecord[]): UsageSummary {
  let requests = 0;
  let failed = 0;
  let inputTokens = 0;
  let cacheTokens = 0;
  let outputTokens = 0;
  let images = 0;
  let latencyMs = 0;
  let ttftMs = 0;
  let textRequests = 0;
  let costUsd = 0;
  for (const r of records) {
    requests += r.requests;
    failed += r.failed;
    inputTokens += r.inputTokens;
    cacheTokens += r.cacheTokens;
    outputTokens += r.outputTokens;
    images += r.images;
    latencyMs += r.latencyMs;
    ttftMs += r.ttftMs;
    if (r.ttftMs > 0) textRequests += r.requests;
    costUsd += r.costUsd;
  }
  const inputAll = inputTokens + cacheTokens;
  return {
    requests,
    failed,
    successRate: requests === 0 ? 1 : (requests - failed) / requests,
    inputTokens,
    cacheTokens,
    outputTokens,
    totalTokens: inputAll + outputTokens,
    cacheHitRate: inputAll === 0 ? 0 : cacheTokens / inputAll,
    images,
    avgLatencyMs: requests === 0 ? 0 : latencyMs / requests,
    avgTtftMs: textRequests === 0 ? 0 : ttftMs / textRequests,
    costUsd: round6(costUsd),
  };
}

/** 一天里各小时的调用比例（白天高、夜里低），用于把日汇总拆成按小时的图 */
const HOURLY_WEIGHTS = [
  0.4, 0.3, 0.2, 0.2, 0.2, 0.3, 0.6, 1.2, 2.4, 3.6, 4.2, 4.4, 3.4, 3.8, 4.6, 4.8, 4.6, 4.2, 3.4,
  2.6, 2.2, 1.8, 1.2, 0.7,
];

export interface UsageBucket {
  /** 天：YYYY-MM-DD；小时：YYYY-MM-DDTHH */
  key: string;
  day: string;
  hour: number | null;
}

export interface UsageSeries {
  /** 模型调用名 / 密钥 id / 通道 id；合并后的其余部分为 'other' */
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

function seriesIdOf(record: UsageRecord, dimension: UsageDimension): string {
  if (dimension === 'model') return record.modelId;
  if (dimension === 'key') return record.keyId;
  return record.group;
}

/**
 * 明细图数据：范围是一天时按 24 小时出柱子，否则按天。
 * 系列按合计从大到小排，超过 maxSeries 个时把排在后面的合并成「其他」。
 */
export function breakdown(
  records: readonly UsageRecord[],
  range: DateRange,
  dimension: UsageDimension,
  metric: UsageMetric,
  maxSeries = 5,
): UsageBreakdown {
  const hourly = isSingleDay(range);
  const lastHour = hourly && range.from === TODAY ? hourOf(CONSOLE_NOW) : 23;
  const buckets: UsageBucket[] = hourly
    ? HOURLY_WEIGHTS.map((_, hour) => ({
        key: `${range.from}T${String(hour).padStart(2, '0')}`,
        day: range.from,
        hour,
      }))
    : rangeDays(range).map((day) => ({ key: day, day, hour: null }));
  const dayIndex = new Map(buckets.map((bucket, index) => [bucket.day, index]));
  const weightSum = HOURLY_WEIGHTS.slice(0, lastHour + 1).reduce((a, b) => a + b, 0);

  const sums = new Map<string, number[]>();
  for (const record of records) {
    if (!inRange(record.day, range)) continue;
    const id = seriesIdOf(record, dimension);
    let values = sums.get(id);
    if (!values) {
      values = buckets.map(() => 0);
      sums.set(id, values);
    }
    const value = metricValue(record, metric);
    if (hourly) {
      for (let hour = 0; hour <= lastHour; hour++) {
        values[hour] = (values[hour] ?? 0) + (value * (HOURLY_WEIGHTS[hour] ?? 0)) / weightSum;
      }
    } else {
      const index = dayIndex.get(record.day);
      if (index !== undefined) values[index] = (values[index] ?? 0) + value;
    }
  }

  return rankSeries(buckets, sums, maxSeries);
}

/**
 * 把各系列按合计从大到小排，超过 maxSeries 个时把排在后面的合并成「其他」，再算出每个柱子的合计。
 * sums 里每个系列的数组和 buckets 一一对应。占位数据和后端数据共用。
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

/** 每天的合计（热力图与活跃统计用） */
export function dailyTotals(
  records: readonly UsageRecord[] = USAGE_RECORDS,
): Map<string, DayTotal> {
  const totals = new Map<string, DayTotal>();
  for (const record of records) {
    const current = totals.get(record.day) ?? { tokens: 0, requests: 0, costUsd: 0 };
    current.tokens += totalTokens(record);
    current.requests += record.requests;
    current.costUsd = round6(current.costUsd + record.costUsd);
    totals.set(record.day, current);
  }
  return totals;
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

/** 某个密钥近 30 天、今天与累计的用量 */
export function keyUsage(keyId: string, records: readonly UsageRecord[] = USAGE_RECORDS): KeyUsage {
  const last30 = presetRange('last30d');
  const usage: KeyUsage = {
    last30: { requests: 0, costUsd: 0 },
    today: { requests: 0, costUsd: 0 },
    totalCostUsd: 0,
  };
  for (const record of records) {
    if (record.keyId !== keyId) continue;
    usage.totalCostUsd += record.costUsd;
    if (inRange(record.day, last30)) {
      usage.last30.requests += record.requests;
      usage.last30.costUsd += record.costUsd;
    }
    if (record.day === TODAY) {
      usage.today.requests += record.requests;
      usage.today.costUsd += record.costUsd;
    }
  }
  usage.totalCostUsd = round6(usage.totalCostUsd);
  usage.last30.costUsd = round6(usage.last30.costUsd);
  usage.today.costUsd = round6(usage.today.costUsd);
  return usage;
}
