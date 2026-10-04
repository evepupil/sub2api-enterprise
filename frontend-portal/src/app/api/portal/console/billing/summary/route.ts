import type { NextRequest } from 'next/server';

import { hasSessionCookie } from '@/lib/server/session/cookies';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  withSession,
} from '@/lib/server/session/session';
import { BALANCE_SUMMARY_PATH, toBalanceSummary } from '@/lib/server/sub2api/balance';
import { callBackend } from '@/lib/server/sub2api/client';

/**
 * 账单页的余额卡：GET，无参数。带着登录状态转给后端的余额汇总接口（凭证过期会自动续期）。
 * 没登录返回 401（页面据此跳登录页），查询太频繁返回 429。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({ method: 'GET', path: BALANCE_SUMMARY_PATH, accessToken, forwarded }),
  );
  if (!result.ok) {
    logBackendFailure('balance summary', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }

  const summary = toBalanceSummary(result.data);
  if (!summary) return authErrorResponse('BACKEND_UNAVAILABLE', 502, writes);
  return jsonResponse({ ok: true, summary }, 200, writes);
}
