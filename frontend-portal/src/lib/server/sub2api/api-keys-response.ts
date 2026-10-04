import type { NextResponse } from 'next/server';

import type { CookieWrite } from '@/lib/server/session/cookies';
import { authErrorResponse, jsonResponse, logBackendFailure } from '@/lib/server/session/session';

import { keyErrorFor, keyErrorStatus } from './api-keys';
import type { BackendError } from './envelope';

/**
 * 密钥的创建、修改、删除失败时回给浏览器的响应：登录失效回 401（页面跳登录页），
 * 其余回 { ok: false, error: { reason, status } }，reason 由页面写成一句话。
 */
export function keyFailureResponse(
  scope: string,
  error: BackendError,
  writes: CookieWrite[],
): NextResponse {
  if (error.status === 401) return authErrorResponse('NOT_LOGGED_IN', 401, writes);
  const reason = keyErrorFor(error);
  if (reason === 'unavailable') logBackendFailure(scope, { ok: false, error });
  const status = keyErrorStatus(reason);
  return jsonResponse({ ok: false, error: { reason, status } }, status, writes);
}

/** 地址里的密钥 ID：正整数，否则 null */
export function parseKeyId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && String(id) === value ? id : null;
}
