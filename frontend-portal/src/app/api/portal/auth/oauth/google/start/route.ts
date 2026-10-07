import type { NextRequest } from 'next/server';

import {
  authorizeUrlFrom,
  BACKEND_STATE_COOKIE,
  backendStartQuery,
  clearedOAuthCookie,
  cookieJar,
  encodeOAuthCookie,
  failureFor,
  loginErrorPath,
  OAUTH_PENDING_COOKIE,
  OAUTH_STATE_COOKIE,
  oauthCookieWrite,
  parseStartParams,
  type OAuthError,
} from '@/lib/server/oauth/google';
import { isSecureRequest } from '@/lib/server/session/cookies';
import { publicOriginFor } from '@/lib/server/session/origin';
import { redirectResponse } from '@/lib/server/session/session';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';
import { relayBackend } from '@/lib/server/sub2api/relay';

/**
 * 谷歌登录发起：登录页、注册页的「使用 Google 账号登录 / 注册」整页跳到这里（GET）。
 * 替浏览器调后台 start，拿到谷歌授权地址和后台记状态的 cookie；cookie 转存进官网的临时 cookie，
 * 再把浏览器送去谷歌。后台没开谷歌登录、配置不全等情况回登录页显示原因。
 * 查询参数：locale、next（登录后去的控制台地址），注册页另带 invitation_code、organization_name、
 * member_name、aff、promo。
 */
export async function GET(request: NextRequest) {
  const params = parseStartParams(request.nextUrl.searchParams);
  const origin = publicOriginFor(request.url, request.headers);
  const secure = isSecureRequest(request.url, request.headers);
  const fail = (error: OAuthError) =>
    redirectResponse(`${origin}${loginErrorPath(params.locale, error)}`, [
      clearedOAuthCookie(OAUTH_STATE_COOKIE, secure),
    ]);

  const result = await relayBackend({
    method: 'GET',
    path: '/auth/oauth/google/start',
    query: backendStartQuery(params),
    forwarded: forwardedHeaders(request.headers),
  });
  if (!result) return fail('failed');
  if (result.status < 300 || result.status >= 400) {
    return fail(failureFor(result.status, result.body));
  }

  const authorizeUrl = authorizeUrlFrom(result.location);
  const cookies = cookieJar(result.setCookies);
  if (!authorizeUrl || !cookies[BACKEND_STATE_COOKIE]) return fail('failed');

  return redirectResponse(authorizeUrl, [
    oauthCookieWrite(
      OAUTH_STATE_COOKIE,
      encodeOAuthCookie({ cookies, next: params.next, locale: params.locale }),
      secure,
    ),
    clearedOAuthCookie(OAUTH_PENDING_COOKIE, secure),
  ]);
}
