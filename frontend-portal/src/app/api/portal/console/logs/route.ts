import type { NextRequest } from 'next/server';

import { hasSessionCookie } from '@/lib/server/session/cookies';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  withSession,
} from '@/lib/server/session/session';
import { callBackend } from '@/lib/server/sub2api/client';
import { parseLogQuery, toLogsPage, usageLogsPath } from '@/lib/server/sub2api/usage-logs';

/**
 * 控制台日志页的一页数据：GET ?from&to&key&model&type&stream&page&pageSize。
 * 带着登录状态读后端使用记录（只有计费成功的调用），挑出页面要用的字段；没登录先回 401。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const query = parseLogQuery(request.nextUrl.searchParams);
  if (!query) return authErrorResponse('BAD_REQUEST', 400);

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({
      method: 'GET',
      path: usageLogsPath(query, query.page, query.pageSize),
      accessToken,
      forwarded,
    }),
  );
  if (!result.ok) {
    logBackendFailure('console logs', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }

  const page = toLogsPage(result.data);
  if (!page) return authErrorResponse('BACKEND_UNAVAILABLE', 502, writes);
  return jsonResponse({ ok: true, ...page }, 200, writes);
}
