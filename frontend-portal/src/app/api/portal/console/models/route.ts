import type { NextRequest } from 'next/server';

import type { ConsoleModelsData } from '@/lib/console/live/models-types';
import { hasSessionCookie } from '@/lib/server/session/cookies';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  withSession,
} from '@/lib/server/session/session';
import { callBackend } from '@/lib/server/sub2api/client';
import { backendError, PORTAL_REASONS, type BackendResult } from '@/lib/server/sub2api/envelope';
import { toConsoleChannels } from '@/lib/server/sub2api/model-plaza';

/**
 * 控制台模型页的数据：带着登录状态读后端「模型广场」（账号能用的分组、每个分组的模型与单价、官方价）。
 * 访问凭证过期会自动续期。模型广场没在后台打开时后端回 404，这里当作没有可用模型。
 * 价格只写美元（充值 1 元 = 1 美元），不再读支付配置里的充值比例。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const { result, writes } = await withSession<ConsoleModelsData>(
    request,
    async (accessToken, forwarded): Promise<BackendResult<ConsoleModelsData>> => {
      const plaza = await callBackend<unknown>({
        method: 'GET',
        path: '/model-plaza',
        accessToken,
        forwarded,
      });
      if (!plaza.ok) {
        if (plaza.error.status === 404) return { ok: true, data: { channels: [] } };
        return { ok: false, error: plaza.error };
      }
      const channels = toConsoleChannels(plaza.data);
      if (!channels) return { ok: false, error: backendError(502, PORTAL_REASONS.badResponse) };
      return { ok: true, data: { channels } };
    },
  );

  if (!result.ok) {
    logBackendFailure('console models', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }
  return jsonResponse({ ok: true, ...result.data }, 200, writes);
}
