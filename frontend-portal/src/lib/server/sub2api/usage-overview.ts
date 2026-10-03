import { daysBetween } from '@/lib/console/time';
import {
  USAGE_MAX_RANGE_DAYS,
  type UsageOverview,
  type UsageOverviewBucket,
  type UsageOverviewPoint,
} from '@/lib/console/live/usage-types';

/**
 * 控制台用量页的后端接口：查询参数的校验、拼后端地址、把后端结果换成浏览器用的形状。纯函数，单测锁住。
 * 后端接口见技术设计 18.2；日期一律按北京时间划分，和控制台显示一致。
 */

export const USAGE_TIMEZONE = 'Asia/Shanghai';

export interface UsageQuery {
  from: string;
  to: string;
  /** 要不要按模型 / 密钥 / 通道拆开（明细图要，热力图不要） */
  detail: boolean;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(value: string | null): value is string {
  if (value === null || !DATE_PATTERN.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** 浏览器传来的 ?from=&to=&detail=1；日期不合法、起止颠倒或超过最长范围时返回 null */
export function parseUsageQuery(params: URLSearchParams): UsageQuery | null {
  const from = params.get('from');
  const to = params.get('to');
  if (!isDateKey(from) || !isDateKey(to) || from > to) return null;
  if (daysBetween(from, to) + 1 > USAGE_MAX_RANGE_DAYS) return null;
  return { from, to, detail: params.get('detail') === '1' };
}

/** 后端地址：一天按小时，多天按天；要明细时带上三个拆分维度 */
export function usageOverviewPath(query: UsageQuery): string {
  const params = new URLSearchParams({
    start_date: query.from,
    end_date: query.to,
    timezone: USAGE_TIMEZONE,
    granularity: query.from === query.to ? 'hour' : 'day',
  });
  if (query.detail) params.set('dimensions', 'model,api_key,group');
  return `/usage/dashboard/overview?${params.toString()}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

function toBucket(raw: Record<string, unknown>): UsageOverviewBucket | null {
  if (typeof raw.bucket !== 'string') return null;
  return {
    bucket: raw.bucket,
    requests: num(raw.requests),
    tokens: num(raw.total_tokens),
    costUsd: num(raw.actual_cost),
  };
}

/** 模型系列用模型名当 ID；密钥、通道用后端 ID */
function toPoint(raw: Record<string, unknown>, idFromName: boolean): UsageOverviewPoint | null {
  const bucket = toBucket(raw);
  if (!bucket) return null;
  const name = typeof raw.name === 'string' ? raw.name : '';
  const id = idFromName ? name : String(num(raw.id));
  if (idFromName && name === '') return null;
  return { ...bucket, id, name };
}

function points(value: unknown, idFromName: boolean): UsageOverviewPoint[] {
  return list(value)
    .map((raw) => toPoint(raw, idFromName))
    .filter((point): point is UsageOverviewPoint => point !== null);
}

/** 后端 data → 浏览器用的用量总览；缺了合计或时间段这种关键字段时返回 null */
export function toUsageOverview(raw: unknown): UsageOverview | null {
  if (!isRecord(raw) || !isRecord(raw.summary) || !Array.isArray(raw.buckets)) return null;
  if (typeof raw.start_date !== 'string' || typeof raw.end_date !== 'string') return null;
  const summary = raw.summary;
  return {
    from: raw.start_date,
    to: raw.end_date,
    granularity: raw.granularity === 'hour' ? 'hour' : 'day',
    summary: {
      requests: num(summary.requests),
      inputTokens: num(summary.input_tokens),
      outputTokens: num(summary.output_tokens),
      cacheCreationTokens: num(summary.cache_creation_tokens),
      cacheReadTokens: num(summary.cache_read_tokens),
      totalTokens: num(summary.total_tokens),
      costUsd: num(summary.actual_cost),
      avgLatencyMs: num(summary.average_duration_ms),
      avgFirstTokenMs: num(summary.average_first_token_ms),
      failedRequests:
        typeof summary.failed_requests === 'number' && Number.isFinite(summary.failed_requests)
          ? summary.failed_requests
          : null,
    },
    buckets: list(raw.buckets)
      .map(toBucket)
      .filter((bucket): bucket is UsageOverviewBucket => bucket !== null),
    series: {
      model: points(raw.models, true),
      key: points(raw.api_keys, false),
      group: points(raw.groups, false),
    },
  };
}
