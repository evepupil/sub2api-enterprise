import type { NextRequest } from 'next/server';

import { jsonResponse, readJsonBody, withSession } from '@/lib/server/session/session';
import { PROFILE_PATH, parseProfileInput, profilePayload } from '@/lib/server/sub2api/account';
import {
  accountFailureResponse,
  accountReasonResponse,
  guardAccountWrite,
} from '@/lib/server/sub2api/account-route';
import { callBackend } from '@/lib/server/sub2api/client';

/**
 * 改用户名：PUT { username } → 后端 PUT /user。回 { ok: true, username }（后端存下的用户名），
 * 页面据此更新头像菜单里的名字；只改用户名，邮箱、组织等不动。
 */
export async function PUT(request: NextRequest) {
  const blocked = guardAccountWrite(request);
  if (blocked) return blocked;
  const input = parseProfileInput(await readJsonBody(request));
  if (!input) return accountReasonResponse('invalid');

  const { result, writes } = await withSession<unknown>(request, (accessToken, forwarded) =>
    callBackend<unknown>({
      method: 'PUT',
      path: PROFILE_PATH,
      body: profilePayload(input),
      accessToken,
      forwarded,
    }),
  );
  if (!result.ok) return accountFailureResponse('account profile', result.error, writes);

  const saved =
    typeof result.data === 'object' && result.data !== null
      ? (result.data as Record<string, unknown>).username
      : undefined;
  return jsonResponse(
    { ok: true, username: typeof saved === 'string' ? saved : input.username },
    200,
    writes,
  );
}
