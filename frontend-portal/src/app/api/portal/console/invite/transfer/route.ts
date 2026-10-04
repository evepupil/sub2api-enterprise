import type { NextRequest } from 'next/server';

import { hasSessionCookie } from '@/lib/server/session/cookies';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  withSession,
} from '@/lib/server/session/session';
import {
  AFFILIATE_TRANSFER_PATH,
  toAffiliateTransfer,
  transferErrorFor,
} from '@/lib/server/sub2api/affiliate';
import { callBackend } from '@/lib/server/sub2api/client';

/**
 * 邀请页的「转入余额」：POST，无参数。把当前可转的返利全部转进余额（sub2api 原有接口）。
 * 成功回转了多少与转完的余额；没有可转的、太频繁、服务不可用各回一个原因。没登录返回 401。
 */
export async function POST(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({ method: 'POST', path: AFFILIATE_TRANSFER_PATH, accessToken, forwarded }),
  );
  if (!result.ok) {
    if (result.error.status === 401) return authErrorResponse('NOT_LOGGED_IN', 401, writes);
    logBackendFailure('affiliate transfer', result);
    const reason = transferErrorFor(result.error);
    const status = result.error.status >= 500 ? 503 : result.error.status;
    return jsonResponse({ ok: false, error: { reason, status } }, status, writes);
  }

  const transfer = toAffiliateTransfer(result.data);
  if (!transfer) {
    return jsonResponse({ ok: false, error: { reason: 'unavailable', status: 502 } }, 502, writes);
  }
  return jsonResponse({ ok: true, transfer }, 200, writes);
}
