import type { NextRequest } from 'next/server';

import type { KeyGroupOption } from '@/lib/console/live/keys-types';
import { hasSessionCookie } from '@/lib/server/session/cookies';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  withSession,
} from '@/lib/server/session/session';
import {
  AVAILABLE_GROUPS_PATH,
  GROUP_RATES_PATH,
  toGroupRates,
  toKeyGroupOptions,
} from '@/lib/server/sub2api/api-keys';
import { callBackend } from '@/lib/server/sub2api/client';
import { backendError, PORTAL_REASONS, type BackendResult } from '@/lib/server/sub2api/envelope';

/**
 * 创建、修改密钥时能选的分组：GET。读后端「账号能用的分组」（组织成员只给组织授权的），
 * 倍率换成账号的专属倍率（读不到专属倍率时用分组默认倍率）。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const { result, writes } = await withSession<KeyGroupOption[]>(
    request,
    async (accessToken, forwarded): Promise<BackendResult<KeyGroupOption[]>> => {
      const [groups, rates] = await Promise.all([
        callBackend<unknown>({
          method: 'GET',
          path: AVAILABLE_GROUPS_PATH,
          accessToken,
          forwarded,
        }),
        callBackend<unknown>({ method: 'GET', path: GROUP_RATES_PATH, accessToken, forwarded }),
      ]);
      if (!groups.ok) return groups;
      const options = toKeyGroupOptions(groups.data, toGroupRates(rates.ok ? rates.data : null));
      if (!options) return { ok: false, error: backendError(502, PORTAL_REASONS.badResponse) };
      return { ok: true, data: options };
    },
  );

  if (!result.ok) {
    logBackendFailure('console key groups', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }
  return jsonResponse({ ok: true, groups: result.data }, 200, writes);
}
