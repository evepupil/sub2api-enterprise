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
import { rechargeMultiplierFrom, toConsoleChannels } from '@/lib/server/sub2api/model-plaza';

/**
 * 控制台模型页的数据：带着登录状态读后端「模型广场」（账号能用的分组、每个分组的模型与单价、官方价），
 * 同时读支付配置里的充值比例（人民币价格按它换算）。访问凭证过期会自动续期。
 * 模型广场没在后台打开时后端回 404，这里当作没有可用模型；充值比例读不到按 1。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const { result, writes } = await withSession<ConsoleModelsData>(
    request,
    async (accessToken, forwarded): Promise<BackendResult<ConsoleModelsData>> => {
      const [plaza, checkout] = await Promise.all([
        callBackend<unknown>({ method: 'GET', path: '/model-plaza', accessToken, forwarded }),
        callBackend<unknown>({
          method: 'GET',
          path: '/payment/checkout-info',
          accessToken,
          forwarded,
        }),
      ]);
      const rechargeMultiplier = rechargeMultiplierFrom(checkout.ok ? checkout.data : null);
      if (!plaza.ok) {
        if (plaza.error.status === 404) {
          return { ok: true, data: { channels: [], rechargeMultiplier } };
        }
        return { ok: false, error: plaza.error };
      }
      const channels = toConsoleChannels(plaza.data);
      if (!channels) return { ok: false, error: backendError(502, PORTAL_REASONS.badResponse) };
      return { ok: true, data: { channels, rechargeMultiplier } };
    },
  );

  if (!result.ok) {
    logBackendFailure('console models', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }
  return jsonResponse({ ok: true, ...result.data }, 200, writes);
}
