import type { NextRequest } from 'next/server';

import {
  BACKEND_PENDING_COOKIES,
  clearedOAuthCookie,
  completeBackendBody,
  decodeOAuthCookie,
  OAUTH_PENDING_COOKIE,
  parseCompleteInput,
} from '@/lib/server/oauth/google';
import {
  clearedCookieWrites,
  isSecureRequest,
  sessionCookieWrites,
  tokenPairFrom,
  TWO_FACTOR_COOKIE,
} from '@/lib/server/session/cookies';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  readJsonBody,
} from '@/lib/server/session/session';
import { parseEnvelope } from '@/lib/server/sub2api/envelope';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';
import { relayBackend } from '@/lib/server/sub2api/relay';

const EXPIRED_STATUS = 410;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 新用户用谷歌账号完成注册：POST { password, invitationCode?, organizationName?, organizationMemberName?, affCode? }
 * → 后台 google/complete-registration（邮箱就是谷歌邮箱，后台已验证，不用邮箱验证码）。
 * 后台成功时回的是不带外壳的令牌，写进登录 cookie、清掉临时 cookie，回 { ok: true, status: 'signed_in' }；
 * 失败按原因回（注册已关闭、要邀请码、组织名不合法等，和注册页同一套原因）。
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);
  const secure = isSecureRequest(request.url, request.headers);
  const clearPending = clearedOAuthCookie(OAUTH_PENDING_COOKIE, secure);

  const input = parseCompleteInput(await readJsonBody(request));
  if (!input) return authErrorResponse('BAD_REQUEST', 400);

  const stored = decodeOAuthCookie(request.cookies.get(OAUTH_PENDING_COOKIE)?.value);
  if (!stored?.cookies[BACKEND_PENDING_COOKIES[0]]) {
    return authErrorResponse('OAUTH_SESSION_EXPIRED', EXPIRED_STATUS, [clearPending]);
  }

  const result = await relayBackend({
    method: 'POST',
    path: '/auth/oauth/google/complete-registration',
    body: completeBackendBody(input),
    cookies: stored.cookies,
    forwarded: forwardedHeaders(request.headers),
  });
  if (!result) return authErrorResponse('BACKEND_UNAVAILABLE', 503);

  if (result.status >= 200 && result.status < 300) {
    // 现在后台回裸令牌；以后改回 { code: 0, data } 外壳也认
    const pair =
      tokenPairFrom(result.body) ??
      (isRecord(result.body) && result.body.code === 0 ? tokenPairFrom(result.body.data) : null);
    if (!pair) {
      logBackendFailure('google complete', {
        ok: false,
        error: { status: 502, reason: 'PORTAL_BAD_RESPONSE', message: 'missing tokens' },
      });
      return authErrorResponse('BACKEND_UNAVAILABLE', 503);
    }
    return jsonResponse({ ok: true, status: 'signed_in' }, 200, [
      ...sessionCookieWrites(pair, secure),
      ...clearedCookieWrites([TWO_FACTOR_COOKIE], secure),
      clearPending,
    ]);
  }

  const parsed = parseEnvelope<unknown>(result.status, result.body);
  if (parsed.ok) return authErrorResponse('BACKEND_UNAVAILABLE', 503);
  logBackendFailure('google complete', parsed);
  const reason = authReasonFor(parsed.error);
  if (reason === 'OAUTH_SESSION_EXPIRED') {
    return authErrorResponse(reason, EXPIRED_STATUS, [clearPending]);
  }
  return authErrorResponse(reason, browserStatusFor(parsed.error));
}
