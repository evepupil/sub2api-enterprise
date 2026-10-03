import type { NextRequest } from 'next/server';

import {
  clearedCookieWrites,
  isSecureRequest,
  SESSION_COOKIE_NAMES,
  sessionCookieWrites,
  tokenPairFrom,
  TWO_FACTOR_COOKIE,
  twoFactorCookieWrite,
} from '@/lib/server/session/cookies';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  readJsonBody,
} from '@/lib/server/session/session';
import { toSessionUser } from '@/lib/server/session/user';
import { callBackend } from '@/lib/server/sub2api/client';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';

/**
 * 登录：邮箱 + 密码转给后端。
 * - 成功：两样凭证写进 cookie，只把当前用户信息返回给浏览器；
 * - 账号开了两步验证：临时凭证写进短期 cookie，告诉浏览器进入输入验证码那一步；
 * - 失败：返回归好类的原因，界面按原因显示中文提示。
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const body = await readJsonBody(request);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (email === '' || password === '' || email.length > 254 || password.length > 512) {
    return authErrorResponse('BAD_REQUEST', 400);
  }

  const result = await callBackend<unknown>({
    method: 'POST',
    path: '/auth/login',
    body: { email, password },
    forwarded: forwardedHeaders(request.headers),
  });
  if (!result.ok) {
    logBackendFailure('login', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error));
  }

  const secure = isSecureRequest(request.url, request.headers);
  const data = (
    typeof result.data === 'object' && result.data !== null ? result.data : {}
  ) as Record<string, unknown>;

  if (data.requires_2fa === true && typeof data.temp_token === 'string' && data.temp_token !== '') {
    return jsonResponse(
      {
        ok: true,
        status: 'requires_2fa',
        emailMasked: typeof data.user_email_masked === 'string' ? data.user_email_masked : '',
      },
      200,
      [
        twoFactorCookieWrite(data.temp_token, secure),
        ...clearedCookieWrites(SESSION_COOKIE_NAMES, secure),
      ],
    );
  }

  const pair = tokenPairFrom(data);
  const user = toSessionUser(data.user);
  if (!pair || !user) {
    logBackendFailure('login', {
      ok: false,
      error: { status: 502, reason: 'PORTAL_BAD_RESPONSE', message: 'missing tokens or user' },
    });
    return authErrorResponse('BACKEND_UNAVAILABLE', 503);
  }

  return jsonResponse({ ok: true, status: 'signed_in', user }, 200, [
    ...sessionCookieWrites(pair, secure),
    ...clearedCookieWrites([TWO_FACTOR_COOKIE], secure),
  ]);
}
