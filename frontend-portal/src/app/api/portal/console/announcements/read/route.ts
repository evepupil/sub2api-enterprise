import type { NextRequest } from 'next/server';

import { hasSessionCookie } from '@/lib/server/session/cookies';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  readJsonBody,
  withSession,
} from '@/lib/server/session/session';
import { markAnnouncementsRead, parseReadIds } from '@/lib/server/sub2api/announcements';

/**
 * 公告标为已读：POST { ids: [...] }（打开一条时传一个，「全部已读」时传全部未读的，最多 20 个）。
 * 在官网服务器上逐条转给后端，浏览器只发一次请求：几条一起发时不会各自去续期登录、互相把凭证顶掉。
 * 只接受官网自己页面发起的请求；成功回实际标上的编号。
 */
export async function POST(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const ids = parseReadIds(await readJsonBody(request));
  if (!ids) return authErrorResponse('BAD_REQUEST', 400);

  const { result, writes } = await withSession<number[]>(request, (accessToken, forwarded) =>
    markAnnouncementsRead(ids, accessToken, forwarded),
  );
  if (!result.ok) {
    logBackendFailure('announcements read', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }
  return jsonResponse({ ok: true, read: result.data }, 200, writes);
}
