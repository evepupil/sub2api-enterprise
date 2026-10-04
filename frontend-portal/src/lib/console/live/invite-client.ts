import type { AffiliateState } from './invite-types';

/**
 * 浏览器端取邀请数据（官网接口 /api/portal/console/invite）。
 * 结果统一成：拿到了、登录已失效（页面跳登录页）、出错（太频繁或服务暂时不可用）。
 */
export type AffiliateFetchResult =
  | { kind: 'ok'; state: AffiliateState }
  | { kind: 'signed_out' }
  | { kind: 'error'; reason: 'too_many' | 'unavailable' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 官网服务器已经把后端结果整理成固定形状，这里只确认关键字段在 */
function isState(value: unknown): value is AffiliateState {
  if (!isRecord(value)) return false;
  if (value.enabled === false) return true;
  return (
    value.enabled === true &&
    isRecord(value.detail) &&
    typeof value.detail.code === 'string' &&
    isRecord(value.detail.rules)
  );
}

export async function fetchAffiliate(signal?: AbortSignal): Promise<AffiliateFetchResult> {
  try {
    const response = await fetch('/api/portal/console/invite', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
    if (response.status === 401) return { kind: 'signed_out' };
    if (response.status === 429) return { kind: 'error', reason: 'too_many' };
    const body: unknown = await response.json().catch(() => null);
    if (response.ok && isRecord(body) && body.ok === true && isState(body.state)) {
      return { kind: 'ok', state: body.state };
    }
    return { kind: 'error', reason: 'unavailable' };
  } catch {
    return { kind: 'error', reason: 'unavailable' };
  }
}
