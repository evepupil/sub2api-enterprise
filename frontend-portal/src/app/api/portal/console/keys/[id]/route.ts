import type { NextRequest } from 'next/server';

import { hasSessionCookie } from '@/lib/server/session/cookies';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import {
  authErrorResponse,
  jsonResponse,
  readJsonBody,
  withSession,
} from '@/lib/server/session/session';
import {
  keyPath,
  parseUpdateInput,
  toLiveKey,
  toUpdatePayload,
} from '@/lib/server/sub2api/api-keys';
import { keyFailureResponse, parseKeyId } from '@/lib/server/sub2api/api-keys-response';
import { callBackend } from '@/lib/server/sub2api/client';

interface KeyRouteContext {
  params: Promise<{ id: string }>;
}

/**
 * 修改密钥：PATCH /api/portal/console/keys/{id}，请求体只带要改的项
 * （名称、分组、暂停或启用、IP 名单、额度、有效期、限速，或者清零已用额度、清零限速用量）。
 * 只接受官网自己页面发起的请求；成功回改后的密钥。
 */
export async function PATCH(request: NextRequest, context: KeyRouteContext) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const id = parseKeyId((await context.params).id);
  const input = parseUpdateInput(await readJsonBody(request));
  if (id === null || !input) return authErrorResponse('BAD_REQUEST', 400);

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({
      method: 'PUT',
      path: keyPath(id),
      body: toUpdatePayload(input),
      accessToken,
      forwarded,
    }),
  );
  if (!result.ok) return keyFailureResponse('update key', result.error, writes);

  const key = toLiveKey(result.data, new Map(), null);
  return key
    ? jsonResponse({ ok: true, key }, 200, writes)
    : jsonResponse({ ok: false, error: { reason: 'unavailable', status: 502 } }, 502, writes);
}

/** 删除密钥：DELETE /api/portal/console/keys/{id}。只接受官网自己页面发起的请求 */
export async function DELETE(request: NextRequest, context: KeyRouteContext) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const id = parseKeyId((await context.params).id);
  if (id === null) return authErrorResponse('BAD_REQUEST', 400);

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({ method: 'DELETE', path: keyPath(id), accessToken, forwarded }),
  );
  if (!result.ok) return keyFailureResponse('delete key', result.error, writes);
  return jsonResponse({ ok: true }, 200, writes);
}
