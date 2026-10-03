import type { NextRequest } from 'next/server';

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
import { toSessionUser } from '@/lib/server/session/user';
import { callBackend } from '@/lib/server/sub2api/client';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';

const CODE_PATTERN = /^\d{6}$/;

/**
 * 两步验证：用登录那一步存下的临时凭证加上 6 位验证码，向后端换正式凭证。
 * 验证码错了保留临时凭证，可以再输；临时凭证过期或已失效则清掉，界面回到第一步重新登录。
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const secure = isSecureRequest(request.url, request.headers);
  const clearTemp = clearedCookieWrites([TWO_FACTOR_COOKIE], secure);
  const tempToken = request.cookies.get(TWO_FACTOR_COOKIE)?.value;
  if (!tempToken) return authErrorResponse('TWO_FACTOR_EXPIRED', 400);

  const body = await readJsonBody(request);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!CODE_PATTERN.test(code)) return authErrorResponse('TOTP_INVALID_CODE', 400);

  const result = await callBackend<unknown>({
    method: 'POST',
    path: '/auth/login/2fa',
    body: { temp_token: tempToken, totp_code: code },
    forwarded: forwardedHeaders(request.headers),
  });

  if (!result.ok) {
    logBackendFailure('login-2fa', result);
    const reason = authReasonFor(result.error);
    if (reason === 'TOTP_INVALID_CODE' || reason === 'TOO_MANY_REQUESTS') {
      return authErrorResponse(reason, browserStatusFor(result.error));
    }
    // 后端对过期或无效的临时凭证回 400 且不带错误代码：按「验证已过期」处理，回到第一步
    if (result.error.status === 400 || result.error.status === 401) {
      return authErrorResponse('TWO_FACTOR_EXPIRED', 400, clearTemp);
    }
    return authErrorResponse(reason, browserStatusFor(result.error));
  }

  const pair = tokenPairFrom(result.data);
  const user = toSessionUser((result.data as Record<string, unknown> | null)?.user);
  if (!pair || !user) return authErrorResponse('BACKEND_UNAVAILABLE', 503);

  return jsonResponse({ ok: true, status: 'signed_in', user }, 200, [
    ...sessionCookieWrites(pair, secure),
    ...clearTemp,
  ]);
}
