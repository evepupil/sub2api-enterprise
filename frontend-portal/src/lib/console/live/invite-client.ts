import {
  TRANSFER_ERRORS,
  type AffiliateState,
  type AffiliateTransfer,
  type TransferError,
} from './invite-types';

/**
 * 浏览器端取邀请数据、转入余额（官网接口 /api/portal/console/invite*）。
 * 结果统一成：拿到了、登录已失效（页面跳登录页）、出错（太频繁或服务暂时不可用）。
 */
export type AffiliateFetchResult =
  | { kind: 'ok'; state: AffiliateState }
  | { kind: 'signed_out' }
  | { kind: 'error'; reason: 'too_many' | 'unavailable' };

export type TransferOutcome =
  | { kind: 'ok'; transfer: AffiliateTransfer }
  | { kind: 'signed_out' }
  | { kind: 'error'; reason: TransferError };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 官网服务器已经把后端结果整理成固定形状，这里只确认关键字段在 */
function isState(value: unknown): value is AffiliateState {
  if (!isRecord(value)) return false;
  if (value.enabled === false) return true;
  return value.enabled === true && isRecord(value.detail) && typeof value.detail.code === 'string';
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

const isTransferError = (value: unknown): value is TransferError =>
  typeof value === 'string' && (TRANSFER_ERRORS as readonly string[]).includes(value);

/** 把可转的返利全部转进余额 */
export async function transferAffiliate(): Promise<TransferOutcome> {
  try {
    const response = await fetch('/api/portal/console/invite/transfer', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (response.status === 401) return { kind: 'signed_out' };
    const body: unknown = await response.json().catch(() => null);
    if (response.ok && isRecord(body) && body.ok === true && isRecord(body.transfer)) {
      const { transferredUsd, balanceUsd } = body.transfer;
      if (typeof transferredUsd === 'number' && typeof balanceUsd === 'number') {
        return { kind: 'ok', transfer: { transferredUsd, balanceUsd } };
      }
    }
    const reason =
      isRecord(body) && isRecord(body.error) && isTransferError(body.error.reason)
        ? body.error.reason
        : response.status === 429
          ? 'too_many'
          : 'unavailable';
    return { kind: 'error', reason };
  } catch {
    return { kind: 'error', reason: 'unavailable' };
  }
}
