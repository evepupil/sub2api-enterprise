import type { NextRequest } from 'next/server';

import { RESET_LIMITS, resetEmailError } from '@/lib/auth/password-reset';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/register-form';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  readJsonBody,
} from '@/lib/server/session/session';
import { callBackend } from '@/lib/server/sub2api/client';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';

/**
 * 重置密码：POST { email, token, password }，邮箱和凭证来自邮件里的重置链接。
 * 只接受本站页面发起的请求。成功后这个账号在所有设备上的登录都会失效（后端原有行为），要重新登录。
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const body = await readJsonBody(request);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (
    resetEmailError(email) !== null ||
    token === '' ||
    token.length > RESET_LIMITS.token ||
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > RESET_LIMITS.password
  ) {
    return authErrorResponse('BAD_REQUEST', 400);
  }

  const result = await callBackend<unknown>({
    method: 'POST',
    path: '/auth/reset-password',
    body: { email, token, new_password: password },
    forwarded: forwardedHeaders(request.headers),
  });
  if (!result.ok) {
    logBackendFailure('reset-password', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error));
  }
  return jsonResponse({ ok: true }, 200);
}
