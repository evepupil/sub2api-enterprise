import type { NextRequest } from 'next/server';

import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  readJsonBody,
} from '@/lib/server/session/session';
import { callBackend } from '@/lib/server/sub2api/client';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';

/**
 * 预校验邀请码：有效时告诉界面是平台邀请码还是组织邀请码（组织邀请码注册后直接加入该组织）。
 * 后端对无效的邀请码也是正常返回、只是 valid 为假，错误代码原样带给界面区分「无效」和「已过期」。
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const body = await readJsonBody(request);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (code === '' || code.length > 128) return authErrorResponse('BAD_REQUEST', 400);

  const result = await callBackend<unknown>({
    method: 'POST',
    path: '/auth/validate-invitation-code',
    body: { code },
    forwarded: forwardedHeaders(request.headers),
  });
  if (!result.ok) {
    logBackendFailure('validate-invitation-code', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error));
  }

  const data = (result.data ?? {}) as Record<string, unknown>;
  return jsonResponse(
    {
      ok: true,
      valid: data.valid === true,
      type:
        data.type === 'organization'
          ? 'organization'
          : data.type === 'platform'
            ? 'platform'
            : null,
      errorCode: typeof data.error_code === 'string' ? data.error_code : '',
    },
    200,
  );
}
