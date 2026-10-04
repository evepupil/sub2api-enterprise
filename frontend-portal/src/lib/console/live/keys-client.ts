'use client';

import {
  getPortalJson,
  isRecord,
  sendPortalJson,
  type ActionResult,
  type FetchResult,
} from './loadable';
import type {
  KeyCreateInput,
  KeyErrorReason,
  KeyGroupOption,
  KeysPageData,
  KeysQuery,
  KeyUpdateInput,
  LiveKey,
} from './keys-types';

/**
 * 浏览器端的密钥页数据与操作（官网接口 /api/portal/console/keys*），取数工具见 ./loadable。
 * 创建、修改、删除的结果是「成功 + 数据」或「失败 + 原因」；登录失效时整页跳登录页。
 */

const BASE = '/api/portal/console/keys';

/** 一页密钥（带每把密钥的用量） */
export function fetchKeys(
  query: KeysQuery,
  signal?: AbortSignal,
): Promise<FetchResult<KeysPageData>> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.search) params.set('search', query.search);
  if (query.status !== 'all') params.set('status', query.status);
  return getPortalJson(
    `${BASE}?${params.toString()}`,
    (body) =>
      Array.isArray(body.items) && typeof body.total === 'number'
        ? {
            items: body.items as LiveKey[],
            total: body.total,
            page: typeof body.page === 'number' ? body.page : query.page,
            pageSize: typeof body.pageSize === 'number' ? body.pageSize : query.pageSize,
          }
        : null,
    signal,
  );
}

/** 能选的分组 */
export function fetchKeyGroups(signal?: AbortSignal): Promise<FetchResult<KeyGroupOption[]>> {
  return getPortalJson(
    `${BASE}/groups`,
    (body) => (Array.isArray(body.groups) ? (body.groups as KeyGroupOption[]) : null),
    signal,
  );
}

export type KeyActionResult<T> = ActionResult<T, KeyErrorReason>;

const REASONS: readonly KeyErrorReason[] = [
  'key_exists',
  'key_too_short',
  'key_invalid_chars',
  'invalid_ip',
  'group_not_allowed',
  'not_found',
  'invalid',
  'forbidden',
  'too_many',
  'unavailable',
];

/** 官网接口没给认得的原因时，按状态码归类 */
function fallbackReason(status: number): KeyErrorReason {
  if (status === 400) return 'invalid';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'too_many';
  return 'unavailable';
}

function send<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body: unknown,
  accept: (payload: Record<string, unknown>) => T | null,
): Promise<KeyActionResult<T>> {
  return sendPortalJson(url, method, body, accept, REASONS, fallbackReason);
}

const keyOf = (payload: Record<string, unknown>) =>
  isRecord(payload.key) ? (payload.key as unknown as LiveKey) : null;

/** 创建密钥，成功给新密钥（含完整密钥） */
export function createKey(input: KeyCreateInput): Promise<KeyActionResult<LiveKey>> {
  return send(BASE, 'POST', input, keyOf);
}

/** 修改密钥，成功给改后的密钥 */
export function updateKey(id: number, input: KeyUpdateInput): Promise<KeyActionResult<LiveKey>> {
  return send(`${BASE}/${id}`, 'PATCH', input, keyOf);
}

export function deleteKey(id: number): Promise<KeyActionResult<true>> {
  return send(`${BASE}/${id}`, 'DELETE', undefined, () => true);
}
