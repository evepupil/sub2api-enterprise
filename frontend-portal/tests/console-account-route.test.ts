import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendCall } from '@/lib/server/sub2api/client';
import type { BackendResult } from '@/lib/server/sub2api/envelope';
import { parsePasswordInput, parseProfileInput } from '@/lib/server/sub2api/account';

/** 假的后端：记下每次调用，按「方法 路径」给结果 */
const backend = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; body: unknown }[],
  respond: (() => ({ ok: true, data: null })) as (
    method: string,
    path: string,
  ) => BackendResult<unknown>,
}));

vi.mock('@/lib/server/sub2api/client', () => ({
  callBackend: async (call: BackendCall) => {
    backend.calls.push({ method: call.method, path: call.path, body: call.body });
    return backend.respond(call.method, call.path);
  },
}));

const profileRoute = await import('@/app/api/portal/console/account/profile/route');
const passwordRoute = await import('@/app/api/portal/console/account/password/route');

const ORIGIN = 'http://portal.test';

function request(
  path: string,
  init: { body?: unknown; cookie?: string; origin?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {
    host: 'portal.test',
    cookie: init.cookie ?? 'portal_at=token-1; portal_rt=refresh-1',
    origin: init.origin ?? ORIGIN,
  };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(`${ORIGIN}${path}`, {
    method: 'PUT',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const fail = (status: number, reason = ''): BackendResult<unknown> => ({
  ok: false,
  error: { status, reason, message: '' },
});

beforeEach(() => {
  backend.calls = [];
  backend.respond = () => ({ ok: true, data: null });
});

describe('账户设置的提交内容', () => {
  it('用户名去掉首尾空格后 1–32 个字（按字符数）', () => {
    expect(parseProfileInput({ username: '  林舟 ' })).toEqual({ username: '林舟' });
    expect(parseProfileInput({ username: '   ' })).toBeNull();
    expect(parseProfileInput({ username: '😀'.repeat(32) })).not.toBeNull();
    expect(parseProfileInput({ username: 'a'.repeat(33) })).toBeNull();
    expect(parseProfileInput({ username: 1 })).toBeNull();
  });

  it('新密码至少 6 位、不能和当前密码相同，空格原样保留', () => {
    expect(parsePasswordInput({ current: 'old', next: ' 12345' })).toEqual({
      current: 'old',
      next: ' 12345',
    });
    expect(parsePasswordInput({ current: 'old', next: '12345' })).toBeNull();
    expect(parsePasswordInput({ current: '', next: '123456' })).toBeNull();
    expect(parsePasswordInput({ current: '123456', next: '123456' })).toBeNull();
  });
});

describe('改用户名', () => {
  it('没登录回 401，别的网站发起的回 403，内容不合法回 400，都不调后台', async () => {
    expect(
      (await profileRoute.PUT(request('/x', { cookie: '', body: { username: 'a' } }))).status,
    ).toBe(401);
    expect(
      (
        await profileRoute.PUT(
          request('/x', { origin: 'https://evil.test', body: { username: 'a' } }),
        )
      ).status,
    ).toBe(403);
    const invalid = await profileRoute.PUT(request('/x', { body: { username: ' ' } }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ ok: false, error: { reason: 'invalid', status: 400 } });
    expect(backend.calls).toHaveLength(0);
  });

  it('转给后台 PUT /user，回后台存下的用户名', async () => {
    backend.respond = () => ({ ok: true, data: { id: 7, email: 'a@b.c', username: '林舟' } });
    const response = await profileRoute.PUT(request('/x', { body: { username: ' 林舟 ' } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, username: '林舟' });
    expect(backend.calls).toEqual([{ method: 'PUT', path: '/user', body: { username: '林舟' } }]);
  });

  it('后台出错：登录失效回 401，太频繁回 429，后台故障回 503', async () => {
    backend.respond = () => fail(401);
    expect((await profileRoute.PUT(request('/x', { body: { username: 'a' } }))).status).toBe(401);
    backend.respond = () => fail(429);
    expect((await profileRoute.PUT(request('/x', { body: { username: 'a' } }))).status).toBe(429);
    backend.respond = () => fail(500);
    const down = await profileRoute.PUT(request('/x', { body: { username: 'a' } }));
    expect(await down.json()).toEqual({ ok: false, error: { reason: 'unavailable', status: 503 } });
  });
});

describe('改登录密码', () => {
  it('转给后台 PUT /user/password；成功后清掉登录 cookie（旧登录已失效）', async () => {
    const response = await passwordRoute.PUT(
      request('/x', { body: { current: 'old-pass', next: 'new-pass' } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(backend.calls).toEqual([
      {
        method: 'PUT',
        path: '/user/password',
        body: { old_password: 'old-pass', new_password: 'new-pass' },
      },
    ]);
    const cookies = response.headers.getSetCookie().join('\n');
    expect(cookies).toMatch(/portal_at=;/);
    expect(cookies).toMatch(/portal_rt=;/);
  });

  it('当前密码不对回 password_incorrect，登录不清', async () => {
    backend.respond = () => fail(400, 'PASSWORD_INCORRECT');
    const response = await passwordRoute.PUT(
      request('/x', { body: { current: 'wrong', next: 'new-pass' } }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: { reason: 'password_incorrect', status: 400 },
    });
    expect(response.headers.getSetCookie().join('\n')).not.toMatch(/portal_at=;/);
  });

  it('新密码太短回 400，不调后台', async () => {
    const response = await passwordRoute.PUT(
      request('/x', { body: { current: 'old', next: '123' } }),
    );
    expect(response.status).toBe(400);
    expect(backend.calls).toHaveLength(0);
  });
});
