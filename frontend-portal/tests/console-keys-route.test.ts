import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendCall } from '@/lib/server/sub2api/client';
import type { BackendResult } from '@/lib/server/sub2api/envelope';

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

const listRoute = await import('@/app/api/portal/console/keys/route');
const keyRoute = await import('@/app/api/portal/console/keys/[id]/route');
const groupsRoute = await import('@/app/api/portal/console/keys/groups/route');

const ORIGIN = 'http://portal.test';

function request(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; origin?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {
    host: 'portal.test',
    cookie: init.cookie ?? 'portal_at=token-1',
  };
  if (init.origin !== undefined) headers.origin = init.origin;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(`${ORIGIN}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

const RAW_KEY = {
  id: 7,
  key: 'sk-full-secret-0123456789',
  name: '开发调试',
  group_id: 3,
  status: 'active',
  quota: 0,
  quota_used: 0,
  created_at: '2026-09-14T02:00:00Z',
  group: { id: 3, name: '标准分组', rate_multiplier: 0.3 },
};

beforeEach(() => {
  backend.calls.length = 0;
  backend.respond = () => ({ ok: true, data: null });
});

describe('密钥列表', () => {
  it('没登录 401、参数不对 400，都不问后端', async () => {
    expect((await listRoute.GET(request('/api/portal/console/keys', { cookie: '' }))).status).toBe(
      401,
    );
    expect((await listRoute.GET(request('/api/portal/console/keys?pageSize=33'))).status).toBe(400);
    expect(backend.calls).toEqual([]);
  });

  it('同时读列表、专属倍率和用量；带完整密钥；用量读不到时写 null', async () => {
    backend.respond = (_method, path) => {
      if (path.startsWith('/keys?')) {
        return { ok: true, data: { items: [RAW_KEY], total: 1, page: 1, page_size: 20 } };
      }
      if (path === '/groups/rates') return { ok: true, data: { 3: 0.15 } };
      return { ok: false, error: { status: 500, reason: '', message: '' } };
    };
    const response = await listRoute.GET(request('/api/portal/console/keys?status=active'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      total: 1,
      items: [{ id: 7, secret: 'sk-full-secret-0123456789', group: { rate: 0.15 }, usage: null }],
    });
    expect(backend.calls.map((call) => call.path.split('?')[0])).toEqual([
      '/keys',
      '/groups/rates',
      '/usage/dashboard/overview',
    ]);
    expect(backend.calls[0]?.path).toContain('status=active');
  });
});

describe('创建密钥', () => {
  it('没登录 401；别的网站发来的 403；请求体不对 400', async () => {
    const body = { name: '生产', groupId: 3 };
    expect(
      (
        await listRoute.POST(
          request('/api/portal/console/keys', { method: 'POST', body, cookie: '' }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await listRoute.POST(
          request('/api/portal/console/keys', {
            method: 'POST',
            body,
            origin: 'https://evil.test',
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await listRoute.POST(
          request('/api/portal/console/keys', {
            method: 'POST',
            body: { name: '', groupId: 3 },
            origin: ORIGIN,
          }),
        )
      ).status,
    ).toBe(400);
    expect(backend.calls).toEqual([]);
  });

  it('照 sub2api 转给后端，回新密钥（含完整密钥）', async () => {
    backend.respond = () => ({ ok: true, data: RAW_KEY });
    const response = await listRoute.POST(
      request('/api/portal/console/keys', {
        method: 'POST',
        origin: ORIGIN,
        body: { name: '生产', groupId: 3, quota: 20, expiresInDays: 30 },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, key: { id: 7, secret: RAW_KEY.key } });
    expect(backend.calls).toEqual([
      {
        method: 'POST',
        path: '/keys',
        body: { name: '生产', group_id: 3, quota: 20, expires_in_days: 30 },
      },
    ]);
  });

  it('后端说自定义密钥已存在：回 409 和原因', async () => {
    backend.respond = () => ({
      ok: false,
      error: { status: 409, reason: 'API_KEY_EXISTS', message: 'api key already exists' },
    });
    const response = await listRoute.POST(
      request('/api/portal/console/keys', {
        method: 'POST',
        origin: ORIGIN,
        body: { name: '生产', groupId: 3, customKey: 'my_custom-key_123456' },
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: { reason: 'key_exists', status: 409 },
    });
  });
});

describe('修改与删除', () => {
  it('修改转成后端的 PUT；ID 不对 400', async () => {
    backend.respond = () => ({ ok: true, data: { ...RAW_KEY, status: 'inactive' } });
    expect(
      (
        await keyRoute.PATCH(
          request('/api/portal/console/keys/abc', {
            method: 'PATCH',
            origin: ORIGIN,
            body: { status: 'inactive' },
          }),
          context('abc'),
        )
      ).status,
    ).toBe(400);
    const response = await keyRoute.PATCH(
      request('/api/portal/console/keys/7', {
        method: 'PATCH',
        origin: ORIGIN,
        body: { status: 'inactive' },
      }),
      context('7'),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, key: { status: 'inactive' } });
    expect(backend.calls).toEqual([
      { method: 'PUT', path: '/keys/7', body: { status: 'inactive' } },
    ]);
  });

  it('删除转成后端的 DELETE；密钥不在了回 404', async () => {
    const ok = await keyRoute.DELETE(
      request('/api/portal/console/keys/7', { method: 'DELETE', origin: ORIGIN }),
      context('7'),
    );
    expect(ok.status).toBe(200);
    expect(backend.calls).toEqual([{ method: 'DELETE', path: '/keys/7', body: undefined }]);

    backend.respond = () => ({
      ok: false,
      error: { status: 404, reason: 'API_KEY_NOT_FOUND', message: '' },
    });
    const missing = await keyRoute.DELETE(
      request('/api/portal/console/keys/8', { method: 'DELETE', origin: ORIGIN }),
      context('8'),
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      ok: false,
      error: { reason: 'not_found', status: 404 },
    });
  });
});

describe('能选的分组', () => {
  it('读能用的分组和专属倍率；专属倍率读不到时用分组默认倍率', async () => {
    backend.respond = (_method, path) =>
      path === '/groups/available'
        ? { ok: true, data: [{ id: 3, name: '标准分组', rate_multiplier: 0.3 }] }
        : { ok: false, error: { status: 500, reason: '', message: '' } };
    const response = await groupsRoute.GET(request('/api/portal/console/keys/groups'));
    expect(await response.json()).toEqual({
      ok: true,
      groups: [{ id: 3, name: '标准分组', description: '', rate: 0.3 }],
    });
  });
});
