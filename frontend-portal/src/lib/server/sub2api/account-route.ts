import type { NextRequest, NextResponse } from 'next/server';

import type { AccountErrorReason } from '@/lib/console/live/account-types';
import type { CookieWrite } from '@/lib/server/session/cookies';
import { hasSessionCookie } from '@/lib/server/session/cookies';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authErrorResponse, jsonResponse, logBackendFailure } from '@/lib/server/session/session';

import { accountErrorFor, accountErrorStatus } from './account';
import type { BackendError } from './envelope';

/**
 * 账户设置两个官网接口共用的收发：改动前先看登录、只接受本站页面发起的请求；
 * 失败回 { ok: false, error: { reason, status } }，登录失效回 401（页面跳登录页）。
 */

/** 改动前的检查：没登录回 401，不是本站页面发起的回 403；通过时为 null */
export function guardAccountWrite(request: NextRequest): NextResponse | null {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);
  return null;
}

export function accountReasonResponse(
  reason: AccountErrorReason,
  writes: CookieWrite[] = [],
): NextResponse {
  const status = accountErrorStatus(reason);
  return jsonResponse({ ok: false, error: { reason, status } }, status, writes);
}

export function accountFailureResponse(
  scope: string,
  error: BackendError,
  writes: CookieWrite[],
): NextResponse {
  if (error.status === 401) return authErrorResponse('NOT_LOGGED_IN', 401, writes);
  const reason = accountErrorFor(error);
  if (reason === 'unavailable') logBackendFailure(scope, { ok: false, error });
  return accountReasonResponse(reason, writes);
}
