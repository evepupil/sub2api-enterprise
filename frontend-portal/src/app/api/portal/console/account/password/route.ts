import type { NextRequest } from 'next/server';

import {
  clearedCookieWrites,
  isSecureRequest,
  SESSION_COOKIE_NAMES,
} from '@/lib/server/session/cookies';
import { jsonResponse, readJsonBody, withSession } from '@/lib/server/session/session';
import { PASSWORD_PATH, parsePasswordInput, passwordPayload } from '@/lib/server/sub2api/account';
import {
  accountFailureResponse,
  accountReasonResponse,
  guardAccountWrite,
} from '@/lib/server/sub2api/account-route';
import { callBackend } from '@/lib/server/sub2api/client';

/**
 * 改登录密码：PUT { current, next } → 后端 PUT /user/password。
 * 成功后后端让这个账号所有旧凭证失效（包括当前这一个），这里同时清掉登录 cookie，回 { ok: true }，
 * 页面提示用新密码重新登录。当前密码不对回 password_incorrect。
 */
export async function PUT(request: NextRequest) {
  const blocked = guardAccountWrite(request);
  if (blocked) return blocked;
  const input = parsePasswordInput(await readJsonBody(request));
  if (!input) return accountReasonResponse('invalid');

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({
      method: 'PUT',
      path: PASSWORD_PATH,
      body: passwordPayload(input),
      accessToken,
      forwarded,
    }),
  );
  if (!result.ok) return accountFailureResponse('account password', result.error, writes);

  const secure = isSecureRequest(request.url, request.headers);
  return jsonResponse({ ok: true }, 200, clearedCookieWrites(SESSION_COOKIE_NAMES, secure));
}
