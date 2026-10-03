import type { NextRequest } from 'next/server';

import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import { authErrorResponse, jsonResponse, logBackendFailure } from '@/lib/server/session/session';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';
import { getAuthSettings } from '@/lib/server/sub2api/public-settings';

/** 登录注册页要用的后端公开开关（注册是否开放、要不要邮箱验证、邀请码是否必填等），缓存 30 秒 */
export async function GET(request: NextRequest) {
  const result = await getAuthSettings(forwardedHeaders(request.headers));
  if (!result.ok) {
    logBackendFailure('settings', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error));
  }
  return jsonResponse({ ok: true, settings: result.data }, 200);
}
