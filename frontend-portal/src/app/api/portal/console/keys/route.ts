import type { NextRequest } from 'next/server';

import type { KeysPageData, LiveKey } from '@/lib/console/live/keys-types';
import { hasSessionCookie } from '@/lib/server/session/cookies';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import {
  authErrorResponse,
  jsonResponse,
  logBackendFailure,
  readJsonBody,
  withSession,
} from '@/lib/server/session/session';
import {
  consoleToday,
  GROUP_RATES_PATH,
  KEYS_PATH,
  keysListPath,
  keyUsageFrom,
  keyUsagePath,
  parseCreateInput,
  parseKeysQuery,
  toCreatePayload,
  toGroupRates,
  toKeysPage,
  toLiveKey,
} from '@/lib/server/sub2api/api-keys';
import { keyFailureResponse } from '@/lib/server/sub2api/api-keys-response';
import { callBackend } from '@/lib/server/sub2api/client';
import { backendError, PORTAL_REASONS, type BackendResult } from '@/lib/server/sub2api/envelope';

/**
 * 密钥列表：GET ?page&pageSize&search&status。同时读后端密钥列表（带完整密钥，只有账号自己的）、
 * 账号的专属倍率、近 30 天每把密钥的用量；倍率或用量读不到时照常给列表（用量写「—」）。
 */
export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);

  const query = parseKeysQuery(request.nextUrl.searchParams);
  if (!query) return authErrorResponse('BAD_REQUEST', 400);
  const today = consoleToday();

  const { result, writes } = await withSession<KeysPageData>(
    request,
    async (accessToken, forwarded): Promise<BackendResult<KeysPageData>> => {
      const [keys, rates, usage] = await Promise.all([
        callBackend<unknown>({ method: 'GET', path: keysListPath(query), accessToken, forwarded }),
        callBackend<unknown>({ method: 'GET', path: GROUP_RATES_PATH, accessToken, forwarded }),
        callBackend<unknown>({ method: 'GET', path: keyUsagePath(today), accessToken, forwarded }),
      ]);
      // 凭证失效交给上层续期后重来
      if (!keys.ok) return keys;
      const page = toKeysPage(
        keys.data,
        toGroupRates(rates.ok ? rates.data : null),
        usage.ok ? keyUsageFrom(usage.data, today) : null,
      );
      if (!page) return { ok: false, error: backendError(502, PORTAL_REASONS.badResponse) };
      return { ok: true, data: page };
    },
  );

  if (!result.ok) {
    logBackendFailure('console keys', result);
    return authErrorResponse(authReasonFor(result.error), browserStatusFor(result.error), writes);
  }
  return jsonResponse({ ok: true, ...result.data }, 200, writes);
}

/**
 * 创建密钥：POST { name, groupId, customKey?, ipWhitelist?, ipBlacklist?, quota?, expiresInDays?, rateLimits? }。
 * 只接受官网自己页面发起的请求；校验后照 sub2api 的规则转给后端，成功回新密钥（含完整密钥，页面只显示这一次）。
 */
export async function POST(request: NextRequest) {
  if (!hasSessionCookie(request.cookies)) return authErrorResponse('NOT_LOGGED_IN', 401);
  if (!isSameOriginRequest(request.headers)) return authErrorResponse('FORBIDDEN_ORIGIN', 403);

  const input = parseCreateInput(await readJsonBody(request));
  if (!input) return authErrorResponse('BAD_REQUEST', 400);

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({
      method: 'POST',
      path: KEYS_PATH,
      body: toCreatePayload(input),
      accessToken,
      forwarded,
    }),
  );
  if (!result.ok) return keyFailureResponse('create key', result.error, writes);

  const key: LiveKey | null = toLiveKey(result.data, new Map(), null);
  if (!key) {
    return jsonResponse({ ok: false, error: { reason: 'unavailable', status: 502 } }, 502, writes);
  }
  return jsonResponse({ ok: true, key }, 200, writes);
}
