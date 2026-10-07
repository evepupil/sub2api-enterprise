import type { NextRequest } from 'next/server';

import {
  BACKEND_PENDING_COOKIES,
  clearedOAuthCookie,
  decodeOAuthCookie,
  OAUTH_PENDING_COOKIE,
  pendingInfoFrom,
} from '@/lib/server/oauth/google';
import { isSecureRequest } from '@/lib/server/session/cookies';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import { authErrorResponse, jsonResponse, logBackendFailure } from '@/lib/server/session/session';
import { parseEnvelope } from '@/lib/server/sub2api/envelope';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';
import { relayBackend } from '@/lib/server/sub2api/relay';

/** 待完成会话没了：回 410，同时清掉官网的临时 cookie，页面提示重新用谷歌登录 */
const EXPIRED_STATUS = 410;

/**
 * 完成注册页打开时调：带着后台「待完成注册」的 cookie 问后台 pending/exchange，
 * 回 { ok: true, email, invitationRequired }（谷歌邮箱、是否必须填邀请码）。
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);
  const secure = isSecureRequest(request.url, request.headers);
  const clearPending = clearedOAuthCookie(OAUTH_PENDING_COOKIE, secure);

  const stored = decodeOAuthCookie(request.cookies.get(OAUTH_PENDING_COOKIE)?.value);
  if (!stored?.cookies[BACKEND_PENDING_COOKIES[0]]) {
    return authErrorResponse('OAUTH_SESSION_EXPIRED', EXPIRED_STATUS, [clearPending]);
  }

  const result = await relayBackend({
    method: 'POST',
    path: '/auth/oauth/pending/exchange',
    body: {},
    cookies: stored.cookies,
    forwarded: forwardedHeaders(request.headers),
  });
  if (!result) return authErrorResponse('BACKEND_UNAVAILABLE', 503);

  const parsed = parseEnvelope<unknown>(result.status, result.body);
  if (!parsed.ok) {
    logBackendFailure('google pending', parsed);
    const reason = authReasonFor(parsed.error);
    if (reason === 'OAUTH_SESSION_EXPIRED') {
      return authErrorResponse(reason, EXPIRED_STATUS, [clearPending]);
    }
    return authErrorResponse(reason, browserStatusFor(parsed.error));
  }

  const info = pendingInfoFrom(parsed.data);
  if (!info) return authErrorResponse('BACKEND_UNAVAILABLE', 503);
  return jsonResponse(
    { ok: true, email: info.email, invitationRequired: info.invitationRequired },
    200,
  );
}
