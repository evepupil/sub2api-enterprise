import {
  REDEEM_ERRORS,
  type BalanceSummary,
  type LedgerPage,
  type LedgerQuery,
  type RedeemError,
  type RedeemResult,
} from './billing-types';

/**
 * 浏览器端取账单数据（官网接口 /api/portal/console/billing/*）。结果统一成三种：
 * 拿到了、登录已失效（页面跳登录页）、出错（太频繁或服务暂时不可用）。
 */
export type BillingFetchResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'signed_out' }
  | { kind: 'error'; reason: 'too_many' | 'unavailable' };

export type RedeemOutcome =
  | { kind: 'ok'; result: RedeemResult }
  | { kind: 'signed_out' }
  | { kind: 'error'; reason: RedeemError };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

async function getJson<T>(
  url: string,
  pick: (body: Record<string, unknown>) => T | null,
  signal?: AbortSignal,
): Promise<BillingFetchResult<T>> {
  try {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal });
    if (response.status === 401) return { kind: 'signed_out' };
    if (response.status === 429) return { kind: 'error', reason: 'too_many' };
    const body: unknown = await response.json().catch(() => null);
    const data = response.ok && isRecord(body) && body.ok === true ? pick(body) : null;
    return data === null ? { kind: 'error', reason: 'unavailable' } : { kind: 'ok', data };
  } catch {
    return { kind: 'error', reason: 'unavailable' };
  }
}

/** 官网服务器已经把后端结果整理成固定形状，这里只确认关键字段在 */
const pickSummary = (body: Record<string, unknown>): BalanceSummary | null =>
  isRecord(body.summary) && typeof body.summary.balanceUsd === 'number'
    ? (body.summary as unknown as BalanceSummary)
    : null;

const pickPage = (body: Record<string, unknown>): LedgerPage | null =>
  isRecord(body.page) && Array.isArray(body.page.items) && typeof body.page.total === 'number'
    ? (body.page as unknown as LedgerPage)
    : null;

export function fetchBalanceSummary(
  signal?: AbortSignal,
): Promise<BillingFetchResult<BalanceSummary>> {
  return getJson('/api/portal/console/billing/summary', pickSummary, signal);
}

/** 浏览器 → 官网的查询参数：只带填了的筛选条件 */
export function ledgerSearchParams(query: LedgerQuery): URLSearchParams {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.pageSize) });
  if (query.type) params.set('type', query.type);
  if (query.source) params.set('source', query.source);
  if (query.query !== '') params.set('q', query.query);
  if (query.minUsd !== null) params.set('min', String(query.minUsd));
  if (query.maxUsd !== null) params.set('max', String(query.maxUsd));
  if (query.from !== null) params.set('from', query.from);
  if (query.to !== null) params.set('to', query.to);
  return params;
}

export function fetchLedger(
  query: LedgerQuery,
  signal?: AbortSignal,
): Promise<BillingFetchResult<LedgerPage>> {
  return getJson(
    `/api/portal/console/billing/ledger?${ledgerSearchParams(query).toString()}`,
    pickPage,
    signal,
  );
}

const isRedeemError = (value: unknown): value is RedeemError =>
  typeof value === 'string' && (REDEEM_ERRORS as readonly string[]).includes(value);

/** 兑换一个码；失败时按官网归好类的原因返回，认不出的当服务暂时不可用 */
export async function redeemCode(code: string): Promise<RedeemOutcome> {
  try {
    const response = await fetch('/api/portal/console/billing/redeem', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (response.status === 401) return { kind: 'signed_out' };
    const body: unknown = await response.json().catch(() => null);
    if (response.ok && isRecord(body) && body.ok === true && isRecord(body.result)) {
      const { type, value } = body.result;
      if (typeof type === 'string' && typeof value === 'number') {
        return { kind: 'ok', result: { type, value } };
      }
    }
    const reason =
      isRecord(body) && isRecord(body.error) && isRedeemError(body.error.reason)
        ? body.error.reason
        : response.status === 429
          ? 'too_many'
          : 'unavailable';
    return { kind: 'error', reason };
  } catch {
    return { kind: 'error', reason: 'unavailable' };
  }
}
