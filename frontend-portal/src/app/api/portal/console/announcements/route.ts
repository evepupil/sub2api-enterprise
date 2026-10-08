import type { NextRequest } from 'next/server';

import { hasSessionCookie } from '@/lib/server/session/cookies';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  withSession,
} from '@/lib/server/session/session';
import { ANNOUNCEMENTS_PATH, toAnnouncements } from '@/lib/server/sub2api/announcements';
import { callBackend } from '@/lib/server/sub2api/client';

/**
 * 控制台铃铛的公告：GET，无参数。带着登录状态读 sub2api 发给当前用户的公告
 * （后台已按上下线时间、目标人群筛好，没读的在前、再按新到旧），整理成最多 20 条交给浏览器。
 * 没登录返回 401（页面据此跳登录页）。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({ method: 'GET', path: ANNOUNCEMENTS_PATH, accessToken, forwarded }),
  );
  if (!result.ok) {
    logBackendFailure('announcements', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }

  const items = toAnnouncements(result.data);
  if (!items) return authErrorResponse('BACKEND_UNAVAILABLE', 502, writes);
  return jsonResponse({ ok: true, items }, 200, writes);
}
