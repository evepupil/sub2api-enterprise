import type { UsageOverview } from './usage-types';

/**
 * 浏览器端取用量数据（官网接口 /api/portal/console/usage）。结果统一成三种：
 * 拿到了、登录已失效（页面跳登录页）、出错（太频繁或服务暂时不可用）。
 */
export type UsageFetchResult =
  | { kind: 'ok'; overview: UsageOverview }
  | { kind: 'signed_out' }
  | { kind: 'error'; reason: 'too_many' | 'unavailable' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 官网服务器已经把后端结果整理成固定形状，这里只确认关键字段在 */
function isOverview(value: unknown): value is UsageOverview {
  return (
    isRecord(value) &&
    isRecord(value.summary) &&
    Array.isArray(value.buckets) &&
    isRecord(value.series) &&
    typeof value.from === 'string' &&
    typeof value.to === 'string'
  );
}

export async function fetchUsageOverview(
  query: { from: string; to: string; detail: boolean },
  signal?: AbortSignal,
): Promise<UsageFetchResult> {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.detail) params.set('detail', '1');
  try {
    const response = await fetch(`/api/portal/console/usage?${params.toString()}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
    if (response.status === 401) return { kind: 'signed_out' };
    if (response.status === 429) return { kind: 'error', reason: 'too_many' };
    const body: unknown = await response.json().catch(() => null);
    if (response.ok && isRecord(body) && body.ok === true && isOverview(body.overview)) {
      return { kind: 'ok', overview: body.overview };
    }
    return { kind: 'error', reason: 'unavailable' };
  } catch {
    return { kind: 'error', reason: 'unavailable' };
  }
}
