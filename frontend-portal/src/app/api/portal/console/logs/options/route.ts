import type { NextRequest } from 'next/server';

import type { LogOptions } from '@/lib/console/live/logs-types';
import { hasSessionCookie } from '@/lib/server/session/cookies';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  withSession,
} from '@/lib/server/session/session';
import { callBackend } from '@/lib/server/sub2api/client';
import { CONSOLE_TIMEZONE, parseDateRange } from '@/lib/server/sub2api/date-range';
import type { BackendResult } from '@/lib/server/sub2api/envelope';
import { toLogOptions } from '@/lib/server/sub2api/usage-logs';

/** 账号最多列多少把密钥（筛选下拉用） */
const KEYS_PAGE_SIZE = 100;

/**
 * 日志页筛选下拉的选项：GET ?from&to。同时读账号的密钥列表和这段时间用过的模型；
 * 凭证失效时整体重来（自动续期），其中一项读不到就让那一项为空，不影响看日志。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const range = parseDateRange(request.nextUrl.searchParams);
  if (!range) return authErrorResponse('BAD_REQUEST', 400);

  const { result, writes } = await withSession<LogOptions>(
    request,
    async (accessToken, forwarded): Promise<BackendResult<LogOptions>> => {
      const modelsQuery = new URLSearchParams({
        start_date: range.from,
        end_date: range.to,
        timezone: CONSOLE_TIMEZONE,
      });
      const [keys, models] = await Promise.all([
        callBackend<unknown>({
          method: 'GET',
          path: `/keys?page=1&page_size=${KEYS_PAGE_SIZE}`,
          accessToken,
          forwarded,
        }),
        callBackend<unknown>({
          method: 'GET',
          path: `/usage/dashboard/models?${modelsQuery.toString()}`,
          accessToken,
          forwarded,
        }),
      ]);
      // 凭证失效交给上层续期后重来；其他失败只让对应的选项为空
      if (!keys.ok && keys.error.status === 401) return { ok: false, error: keys.error };
      if (!models.ok && models.error.status === 401) return { ok: false, error: models.error };
      return {
        ok: true,
        data: toLogOptions(keys.ok ? keys.data : null, models.ok ? models.data : null),
      };
    },
  );

  if (!result.ok) {
    logBackendFailure('console log options', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }
  return jsonResponse({ ok: true, ...result.data }, 200, writes);
}
