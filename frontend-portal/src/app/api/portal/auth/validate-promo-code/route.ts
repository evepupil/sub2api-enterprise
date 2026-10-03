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
 * 预校验优惠码：有效时带回注册后赠送的余额（美元）；无效时带回错误代码，界面据此提示
 * 「不存在 / 已过期 / 已停用 / 已领完 / 你已用过」。
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const body = await readJsonBody(request);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (code === '' || code.length > 128) return authErrorResponse('BAD_REQUEST', 400);

  const result = await callBackend<unknown>({
    method: 'POST',
    path: '/auth/validate-promo-code',
    body: { code },
    forwarded: forwardedHeaders(request.headers),
  });
  if (!result.ok) {
    logBackendFailure('validate-promo-code', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error));
  }

  const data = (result.data ?? {}) as Record<string, unknown>;
  return jsonResponse(
    {
      ok: true,
      valid: data.valid === true,
      bonusAmount: typeof data.bonus_amount === 'number' ? data.bonus_amount : 0,
      errorCode: typeof data.error_code === 'string' ? data.error_code : '',
    },
    200,
  );
}
