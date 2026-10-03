import type { NextRequest } from 'next/server';

import {
  ACCESS_COOKIE,
  clearedCookieWrites,
  isSecureRequest,
  REFRESH_COOKIE,
  SESSION_COOKIE_NAMES,
  TWO_FACTOR_COOKIE,
} from '@/lib/server/session/cookies';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authErrorResponse, jsonResponse, logBackendFailure } from '@/lib/server/session/session';
import { callBackend } from '@/lib/server/sub2api/client';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';

/**
 * 退出登录：通知后端作废续期凭证，再清掉浏览器里的凭证 cookie。
 * 后端通知失败（比如后端暂时连不上）也照样清 cookie：用户点了退出，本机就必须是退出状态。
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    const result = await callBackend<unknown>({
      method: 'POST',
      path: '/auth/logout',
      body: { refresh_token: refreshToken },
      accessToken: request.cookies.get(ACCESS_COOKIE)?.value,
      forwarded: forwardedHeaders(request.headers),
    });
    logBackendFailure('logout', result);
  }

  const secure = isSecureRequest(request.url, request.headers);
  return jsonResponse(
    { ok: true },
    200,
    clearedCookieWrites([...SESSION_COOKIE_NAMES, TWO_FACTOR_COOKIE], secure),
  );
}
