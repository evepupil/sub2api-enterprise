import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendCall } from '@/lib/server/sub2api/client';
import type { BackendResult } from '@/lib/server/sub2api/envelope';

/** 假的后端：按路径给结果，并记下每次调用 */
const backend = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; accessToken?: string; body?: unknown }>,
  respond: (() => ({ ok: true, data: null })) as (call: BackendCall) => BackendResult<unknown>,
}));

vi.mock('@/lib/server/sub2api/client', () => ({
  callBackend: async (call: BackendCall) => {
    backend.calls.push({ path: call.path, accessToken: call.accessToken, body: call.body });
    // 让并发请求真正交错，才能测出续期去重
    await new Promise((resolve) => setTimeout(resolve, 5));
    return backend.respond(call);
  },
}));

const { callBackend } = await import('@/lib/server/sub2api/client');
const { withSession } = await import('@/lib/server/session/session');

const me = (accessToken: string) =>
  callBackend<unknown>({ method: 'GET', path: '/auth/me', accessToken, forwarded: new Headers() });

function requestWith(cookies: Record<string, string>): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return new NextRequest('http://127.0.0.1:3000/api/portal/auth/me', {
    headers: cookie ? { cookie } : {},
  });
}

const tokens = (n: number) => ({ access_token: `a${n}`, refresh_token: `r${n}`, expires_in: 600 });

beforeEach(() => {
  backend.calls.length = 0;
});

describe('带着登录状态调后端', () => {
  it('没有任何凭证：直接按没登录处理，不打扰后端', async () => {
    const { result, writes } = await withSession(requestWith({}), me);
    expect(result).toMatchObject({ ok: false, error: { status: 401 } });
    expect(writes).toEqual([]);
    expect(backend.calls).toEqual([]);
  });

  it('访问凭证有效：调一次，不改 cookie', async () => {
    backend.respond = () => ({ ok: true, data: { id: 1 } });
    const { result, writes } = await withSession(
      requestWith({ portal_at: 'a1', portal_rt: 'r-valid' }),
      me,
    );
    expect(result).toEqual({ ok: true, data: { id: 1 } });
    expect(writes).toEqual([]);
    expect(backend.calls).toEqual([{ path: '/auth/me', accessToken: 'a1', body: undefined }]);
  });

  it('访问凭证过期：续期后用新凭证重试，并写回新 cookie', async () => {
    backend.respond = (call) => {
      if (call.path === '/auth/refresh') return { ok: true, data: tokens(2) };
      return call.accessToken === 'a2'
        ? { ok: true, data: { id: 1 } }
        : { ok: false, error: { status: 401, reason: 'TOKEN_EXPIRED', message: '' } };
    };
    const { result, writes } = await withSession(
      requestWith({ portal_at: 'a-old', portal_rt: 'r-expire' }),
      me,
    );
    expect(result).toEqual({ ok: true, data: { id: 1 } });
    expect(backend.calls.map((c) => c.path)).toEqual(['/auth/me', '/auth/refresh', '/auth/me']);
    expect(writes.map((w) => [w.name, w.value])).toEqual([
      ['portal_at', 'a2'],
      ['portal_rt', 'r2'],
    ]);
  });

  it('访问凭证 cookie 已到期只剩续期凭证：先续期再调', async () => {
    backend.respond = (call) =>
      call.path === '/auth/refresh' ? { ok: true, data: tokens(3) } : { ok: true, data: { id: 1 } };
    const { result } = await withSession(requestWith({ portal_rt: 'r-only' }), me);
    expect(result.ok).toBe(true);
    expect(backend.calls.map((c) => [c.path, c.accessToken])).toEqual([
      ['/auth/refresh', undefined],
      ['/auth/me', 'a3'],
    ]);
  });

  it('续期凭证也失效：清掉 cookie，按没登录处理', async () => {
    backend.respond = () => ({
      ok: false,
      error: { status: 401, reason: 'INVALID_REFRESH_TOKEN', message: '' },
    });
    const { result, writes } = await withSession(requestWith({ portal_rt: 'r-dead' }), me);
    expect(result).toMatchObject({ ok: false, error: { status: 401 } });
    expect(writes.map((w) => [w.name, w.options.maxAge])).toEqual([
      ['portal_at', 0],
      ['portal_rt', 0],
    ]);
  });

  it('续期时后端连不上：保留 cookie，下次再试', async () => {
    backend.respond = () => ({
      ok: false,
      error: { status: 503, reason: 'PORTAL_BACKEND_UNAVAILABLE', message: '' },
    });
    const { result, writes } = await withSession(requestWith({ portal_rt: 'r-down' }), me);
    expect(result).toMatchObject({ ok: false, error: { status: 503 } });
    expect(writes).toEqual([]);
  });

  it('同一个浏览器同时发出好几个请求：续期只发生一次，大家都拿到新凭证', async () => {
    backend.respond = (call) =>
      call.path === '/auth/refresh' ? { ok: true, data: tokens(4) } : { ok: true, data: { id: 1 } };
    const results = await Promise.all(
      [1, 2, 3].map(() => withSession(requestWith({ portal_rt: 'r-shared' }), me)),
    );
    expect(results.every((r) => r.result.ok)).toBe(true);
    expect(backend.calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
    expect(
      backend.calls.filter((c) => c.path === '/auth/me').every((c) => c.accessToken === 'a4'),
    ).toBe(true);
  });
});
