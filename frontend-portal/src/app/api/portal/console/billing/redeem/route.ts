import type { NextRequest } from 'next/server';

import { hasSessionCookie } from '@/lib/server/session/cookies';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  readJsonBody,
  withSession,
} from '@/lib/server/session/session';
import {
  parseRedeemCode,
  REDEEM_PATH,
  redeemErrorFor,
  toRedeemResult,
} from '@/lib/server/sub2api/balance';
import { callBackend } from '@/lib/server/sub2api/client';

/**
 * 账单页的兑换码：POST { code }。转给后端的兑换接口，成功时回码类型与面值，
 * 失败时回按原因归好类的错误（码不存在、已用过、已过期、正在处理、尝试太多、服务不可用）。
 * 没登录返回 401（页面据此跳登录页）。
 */
export async function POST(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const code = parseRedeemCode(await readJsonBody(request));
  if (!code) return authErrorResponse('BAD_REQUEST', 400);

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({
      method: 'POST',
      path: REDEEM_PATH,
      body: { code },
      accessToken,
      forwarded,
    }),
  );
  if (!result.ok) {
    if (result.error.status === 401) return authErrorResponse('NOT_LOGGED_IN', 401, writes);
    logBackendFailure('redeem', result);
    const reason = redeemErrorFor(result.error);
    const status = result.error.status >= 500 ? 503 : result.error.status;
    return jsonResponse({ ok: false, error: { reason, status } }, status, writes);
  }

  const redeemed = toRedeemResult(result.data);
  if (!redeemed) {
    return jsonResponse({ ok: false, error: { reason: 'unavailable', status: 502 } }, 502, writes);
  }
  return jsonResponse({ ok: true, result: redeemed }, 200, writes);
}
