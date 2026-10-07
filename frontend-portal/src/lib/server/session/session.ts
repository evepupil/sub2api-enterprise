import { NextResponse, type NextRequest } from 'next/server';

import { callBackend } from '@/lib/server/sub2api/client';
import { backendError, type BackendResult } from '@/lib/server/sub2api/envelope';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';
import type { AuthErrorReason } from '@/lib/session/types';

import {
  ACCESS_COOKIE,
  clearedCookieWrites,
  isSecureRequest,
  REFRESH_COOKIE,
  SESSION_COOKIE_NAMES,
  sessionCookieWrites,
  tokenPairFrom,
  type CookieWrite,
} from './cookies';
import { createRefresher, type RefreshOutcome } from './refresh';

/**
 * 官网服务器上的登录状态：从 cookie 取凭证去调后端，访问凭证过期就用续期凭证换新再试，
 * 并算出要写回浏览器的 cookie 变化。官网转发接口都经这里，不各自处理续期。
 */

/** 全进程共用一个续期器，同一个续期凭证只换一次（见 refresh.ts） */
const refreshTokens = createRefresher<Headers>(async (refreshToken, forwarded) => {
  const result = await callBackend<unknown>({
    method: 'POST',
    path: '/auth/refresh',
    body: { refresh_token: refreshToken },
    forwarded,
  });
  if (!result.ok) return { ok: false, error: result.error } satisfies RefreshOutcome;
  const pair = tokenPairFrom(result.data);
  return pair
    ? ({ ok: true, pair } satisfies RefreshOutcome)
    : ({ ok: false, error: backendError(502, 'PORTAL_BAD_RESPONSE') } satisfies RefreshOutcome);
});

const NOT_LOGGED_IN = backendError(401, 'PORTAL_NOT_LOGGED_IN');

export interface SessionCallResult<T> {
  result: BackendResult<T>;
  /** 要写回浏览器的 cookie（续期后的新凭证，或登录失效时清空） */
  writes: CookieWrite[];
}

/** 带着登录状态调一次后端；call 拿到可用的访问凭证后发请求 */
export async function withSession<T>(
  request: NextRequest,
  call: (accessToken: string, forwarded: Headers) => Promise<BackendResult<T>>,
): Promise<SessionCallResult<T>> {
  const secure = isSecureRequest(request.url, request.headers);
  const forwarded = forwardedHeaders(request.headers);
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const cleared = clearedCookieWrites(SESSION_COOKIE_NAMES, secure);

  if (!access && !refresh) return { result: { ok: false, error: NOT_LOGGED_IN }, writes: [] };

  if (access) {
    const first = await call(access, forwarded);
    // 成功、或者不是凭证问题的失败，直接返回；凭证失效且没有续期凭证，清掉 cookie
    if (first.ok || first.error.status !== 401) return { result: first, writes: [] };
    if (!refresh) return { result: first, writes: cleared };
  }

  const outcome = await refreshTokens(refresh as string, forwarded);
  if (!outcome.ok) {
    // 后端临时不可用：保留 cookie，下次再试；续期凭证过期或被作废：清掉 cookie，按没登录处理
    if (outcome.error.status >= 500)
      return { result: { ok: false, error: outcome.error }, writes: [] };
    return { result: { ok: false, error: NOT_LOGGED_IN }, writes: cleared };
  }

  const second = await call(outcome.pair.accessToken, forwarded);
  return { result: second, writes: sessionCookieWrites(outcome.pair, secure) };
}

/** 官网接口统一的 JSON 响应：不缓存，顺带写 cookie */
export function jsonResponse(
  body: unknown,
  status: number,
  writes: CookieWrite[] = [],
): NextResponse {
  const response = NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
  for (const write of writes) response.cookies.set(write.name, write.value, write.options);
  return response;
}

/** 整页跳转（谷歌登录的发起与回调用）：不缓存，顺带写 cookie；url 为完整地址 */
export function redirectResponse(url: string, writes: CookieWrite[] = []): NextResponse {
  const response = NextResponse.redirect(url, 302);
  response.headers.set('cache-control', 'no-store');
  for (const write of writes) response.cookies.set(write.name, write.value, write.options);
  return response;
}

/** 官网接口统一的错误响应 */
export function authErrorResponse(
  reason: AuthErrorReason,
  status: number,
  writes: CookieWrite[] = [],
): NextResponse {
  return jsonResponse({ ok: false, error: { reason, status } }, status, writes);
}

/** 读 JSON 请求体，读不出来时返回空对象 */
export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** 后端出了意料之外的错（5xx、看不懂的响应）时记一笔，方便排查；不记凭证与密码 */
export function logBackendFailure(scope: string, result: BackendResult<unknown>): void {
  if (result.ok) return;
  if (result.error.status >= 500 || result.error.reason.startsWith('PORTAL_')) {
    console.warn(
      `[portal-auth] ${scope}: ${result.error.status} ${result.error.reason} ${result.error.message}`,
    );
  }
}
