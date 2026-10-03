import type { NextRequest } from 'next/server';

import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  withSession,
} from '@/lib/server/session/session';
import { toSessionUser } from '@/lib/server/session/user';
import { callBackend } from '@/lib/server/sub2api/client';

/**
 * 当前用户：控制台打开时调一次，拿到邮箱、用户名、所属组织。
 * 访问凭证过期会自动续期并写回新 cookie；续期也失败就清掉 cookie、返回 401，界面据此跳回登录页。
 */
export async function GET(request: NextRequest) {
  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({ method: 'GET', path: '/auth/me', accessToken, forwarded }),
  );

  if (!result.ok) {
    logBackendFailure('me', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }

  const user = toSessionUser(result.data);
  if (!user) return authErrorResponse('BACKEND_UNAVAILABLE', 503, writes);
  return jsonResponse({ ok: true, user }, 200, writes);
}
