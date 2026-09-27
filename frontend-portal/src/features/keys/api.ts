/**
 * 密钥接口调用（只发请求 + 走适配层，不含 UI 状态）。
 *
 * 契约来源：src/features/keys/types.ts（主控冻结）与 design/customer-console.md 第 2、3 节。
 *
 * 边界：
 * - 路径固定为 /keys、/keys/<正整数>、/groups/available，凭证与续期由 ApiRequester 负责。
 * - 响应先经 adapter 白名单校验，内部字段不进页面。
 * - 创建带 Idempotency-Key（同一次提交一个值），本模块自身不重试；写操作不并发重放。
 */

import type { ApiRequester } from '../auth/types';
import { parseAvailableGroups, parseKeyPage, parseKeyRecord } from './adapter';
import type { AvailableGroup, KeyDraft, KeyFilters, KeyRecord, PageResult } from './types';
import { buildKeyPayload } from './validation';

/** 后端列表默认 page_size 上限为 1000，这里按后端可接受的区间收敛。 */
const MAX_PAGE_SIZE = 1000;

function assertPositiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`密钥${field}不正确`);
  }
  return value;
}

function keyPath(id: number): string {
  return `/keys/${assertPositiveInteger(id, 'ID')}`;
}

function listQuery(filters: KeyFilters): string {
  const params = new URLSearchParams();
  params.set('page', String(assertPositiveInteger(filters.page, '页码')));
  const pageSize = assertPositiveInteger(filters.pageSize, '每页数量');
  params.set('page_size', String(Math.min(pageSize, MAX_PAGE_SIZE)));

  const search = filters.search?.trim() ?? '';
  if (search !== '') {
    params.set('search', search);
  }
  const status = filters.status?.trim() ?? '';
  if (status !== '') {
    params.set('status', status);
  }
  return params.toString();
}

/** 生成一次提交使用的幂等键；同一 payload 重试时由调用方复用同一个值。 */
function newIdempotencyKey(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (typeof uuid === 'string' && uuid.length > 0) {
    return uuid;
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function fetchKeys(
  request: ApiRequester,
  filters: KeyFilters,
  signal?: AbortSignal,
): Promise<PageResult<KeyRecord>> {
  const value = await request<unknown>(`/keys?${listQuery(filters)}`, {
    method: 'GET',
    signal,
  });
  return parseKeyPage(value);
}

export async function fetchAvailableGroups(
  request: ApiRequester,
  signal?: AbortSignal,
): Promise<AvailableGroup[]> {
  const value = await request<unknown>('/groups/available', { method: 'GET', signal });
  return parseAvailableGroups(value);
}

export async function createKey(request: ApiRequester, draft: KeyDraft): Promise<KeyRecord> {
  const payload = buildKeyPayload(draft, 'create');
  const value = await request<unknown>('/keys', {
    method: 'POST',
    body: payload,
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  });
  return parseKeyRecord(value);
}

export async function updateKey(
  request: ApiRequester,
  id: number,
  draft: KeyDraft,
): Promise<KeyRecord> {
  const payload = buildKeyPayload(draft, 'edit');
  const value = await request<unknown>(keyPath(id), {
    method: 'PUT',
    body: payload,
  });
  return parseKeyRecord(value);
}

/** 只提交 status，其余字段保持后端现值，避免停用/启用顺带覆盖额度或分组。 */
export async function setKeyStatus(
  request: ApiRequester,
  id: number,
  status: 'active' | 'inactive',
): Promise<void> {
  await request<unknown>(keyPath(id), {
    method: 'PUT',
    body: { status },
  });
}

export async function deleteKey(request: ApiRequester, id: number): Promise<void> {
  await request<unknown>(keyPath(id), { method: 'DELETE' });
}
