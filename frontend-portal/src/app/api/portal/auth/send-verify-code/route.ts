import type { NextRequest } from 'next/server';

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

/** 后端没给倒计时时按 60 秒（后端默认值） */
const DEFAULT_COUNTDOWN_SECONDS = 60;

/** 注册前发邮箱验证码；返回多少秒后才能重发 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const body = await readJsonBody(request);
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (email === '' || email.length > 254) return authErrorResponse('BAD_REQUEST', 400);

  const result = await callBackend<unknown>({
    method: 'POST',
    path: '/auth/send-verify-code',
    body: { email },
    forwarded: forwardedHeaders(request.headers),
  });
  if (!result.ok) {
    logBackendFailure('send-verify-code', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error));
  }

  const data = (result.data ?? {}) as Record<string, unknown>;
  const countdown =
    typeof data.countdown === 'number' && data.countdown > 0
      ? data.countdown
      : DEFAULT_COUNTDOWN_SECONDS;
  return jsonResponse({ ok: true, countdown }, 200);
}
