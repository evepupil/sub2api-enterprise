import type { NextRequest } from 'next/server';

import { hasSessionCookie } from '@/lib/server/session/cookies';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  withSession,
} from '@/lib/server/session/session';
import { AFFILIATE_PATH, toAffiliateDetail } from '@/lib/server/sub2api/affiliate';
import { callBackend } from '@/lib/server/sub2api/client';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';
import { getAuthSettings } from '@/lib/server/sub2api/public-settings';

/**
 * 邀请页的数据：GET，无参数。先看后台有没有开邀请返利（公开设置，缓存 30 秒），
 * 没开时回 { enabled: false }，不再去问详情；开了就带着登录状态读 sub2api 原有的邀请返利详情。
 * 没登录返回 401（页面据此跳登录页）。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const settings = await getAuthSettings(forwardedHeaders(request.headers));
  if (!settings.ok) {
    logBackendFailure('affiliate settings', settings);
    return authErrorResponse(authReasonFor(settings.error), browserStatusFor(settings.error));
  }
  if (!settings.data.affiliateEnabled) {
    return jsonResponse({ ok: true, state: { enabled: false } }, 200);
  }

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({ method: 'GET', path: AFFILIATE_PATH, accessToken, forwarded }),
  );
  if (!result.ok) {
    logBackendFailure('affiliate detail', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }

  const detail = toAffiliateDetail(result.data);
  if (!detail) return authErrorResponse('BACKEND_UNAVAILABLE', 502, writes);
  return jsonResponse({ ok: true, state: { enabled: true, detail } }, 200, writes);
}
