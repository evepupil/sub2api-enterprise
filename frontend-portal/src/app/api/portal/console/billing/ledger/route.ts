import type { NextRequest } from 'next/server';

import { hasSessionCookie } from '@/lib/server/session/cookies';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  withSession,
} from '@/lib/server/session/session';
import { ledgerPath, parseLedgerQuery, toLedgerPage } from '@/lib/server/sub2api/balance';
import { callBackend } from '@/lib/server/sub2api/client';

/**
 * 账单页的交易记录（只含余额变动）：GET ?page=&size=&type=&source=&q=&min=&max=&from=&to=。
 * 先看登录再查参数：没登录的请求一律 401，不暴露参数校验的细节；参数不合法 400。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const query = parseLedgerQuery(request.nextUrl.searchParams);
  if (!query) return authErrorResponse('BAD_REQUEST', 400);

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({ method: 'GET', path: ledgerPath(query), accessToken, forwarded }),
  );
  if (!result.ok) {
    logBackendFailure('balance ledger', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }

  const page = toLedgerPage(result.data);
  if (!page) return authErrorResponse('BACKEND_UNAVAILABLE', 502, writes);
  return jsonResponse({ ok: true, page }, 200, writes);
}
