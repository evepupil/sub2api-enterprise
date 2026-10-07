import type { NextRequest } from 'next/server';

import {
  afterLoginPath,
  BACKEND_PENDING_COOKIES,
  callbackOutcome,
  clearedOAuthCookie,
  completePath,
  cookieJar,
  decodeOAuthCookie,
  encodeOAuthCookie,
  failureFor,
  loginErrorPath,
  OAUTH_PENDING_COOKIE,
  OAUTH_STATE_COOKIE,
  oauthCookieWrite,
  type OAuthError,
} from '@/lib/server/oauth/google';
import {
  clearedCookieWrites,
  isSecureRequest,
  sessionCookieWrites,
  TWO_FACTOR_COOKIE,
} from '@/lib/server/session/cookies';
import { publicOriginFor } from '@/lib/server/session/origin';
import { redirectResponse } from '@/lib/server/session/session';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';
import { relayBackend } from '@/lib/server/sub2api/relay';

/**
 * 谷歌授权完回到这里（后台设置里「谷歌回调地址」填 https://官网域名/api/portal/auth/oauth/google/callback）。
 * 带着发起时存下的后台 cookie，把谷歌给的参数原样转给后台 callback，读后台跳转地址里的结果：
 * - 老用户（含同邮箱的已有账号）：令牌写进登录 cookie，进控制台；
 * - 新用户：存下后台「待完成注册」的 cookie，去完成注册页；
 * - 出错或发起时的 cookie 已过期：回登录页显示原因。
 */
export async function GET(request: NextRequest) {
  const origin = publicOriginFor(request.url, request.headers);
  const secure = isSecureRequest(request.url, request.headers);
  const stored = decodeOAuthCookie(request.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const locale = stored?.locale ?? 'zh';
  const clearState = clearedOAuthCookie(OAUTH_STATE_COOKIE, secure);
  const fail = (error: OAuthError) =>
    redirectResponse(`${origin}${loginErrorPath(locale, error)}`, [clearState]);

  if (!stored) return fail('expired');

  const result = await relayBackend({
    method: 'GET',
    path: '/auth/oauth/google/callback',
    query: request.nextUrl.searchParams.toString(),
    cookies: stored.cookies,
    forwarded: forwardedHeaders(request.headers),
  });
  if (!result) return fail('failed');
  if (result.status < 300 || result.status >= 400) {
    return fail(failureFor(result.status, result.body));
  }

  const outcome = callbackOutcome(result.location);
  if (outcome.kind === 'error') return fail(outcome.error);

  if (outcome.kind === 'signed_in') {
    return redirectResponse(`${origin}${afterLoginPath(locale, stored.next)}`, [
      ...sessionCookieWrites(outcome.pair, secure),
      ...clearedCookieWrites([TWO_FACTOR_COOKIE], secure),
      clearState,
      clearedOAuthCookie(OAUTH_PENDING_COOKIE, secure),
    ]);
  }

  const pending = cookieJar(result.setCookies, BACKEND_PENDING_COOKIES);
  if (!pending[BACKEND_PENDING_COOKIES[0]]) return fail('failed');
  return redirectResponse(`${origin}${completePath(locale)}`, [
    clearState,
    oauthCookieWrite(
      OAUTH_PENDING_COOKIE,
      encodeOAuthCookie({ cookies: pending, next: stored.next, locale }),
      secure,
    ),
  ]);
}
