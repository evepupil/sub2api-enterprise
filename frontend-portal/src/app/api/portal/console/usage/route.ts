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
import {
  parseUsageQuery,
  toUsageOverview,
  usageOverviewPath,
} from '@/lib/server/sub2api/usage-overview';

/**
 * 控制台用量页的数据：GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&detail=1。
 * 带着登录状态转给后端的用量总览接口（访问凭证过期会自动续期），把结果换成浏览器用的形状。
 * 没登录返回 401（页面据此跳登录页），查询太频繁返回 429。
 * 先看登录再查参数：没登录的请求一律 401，不暴露参数校验的细节。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const query = parseUsageQuery(request.nextUrl.searchParams);
  if (!query) return authErrorResponse('BAD_REQUEST', 400);

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({ method: 'GET', path: usageOverviewPath(query), accessToken, forwarded }),
  );
  if (!result.ok) {
    logBackendFailure('usage overview', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }

  const overview = toUsageOverview(result.data);
  if (!overview) return authErrorResponse('BACKEND_UNAVAILABLE', 502, writes);
  return jsonResponse({ ok: true, overview }, 200, writes);
}
