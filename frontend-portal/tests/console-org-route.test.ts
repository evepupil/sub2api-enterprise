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

const summaryRoute = await import('@/app/api/portal/console/organization/route');
const membersRoute = await import('@/app/api/portal/console/organization/members/route');
const memberRoute = await import('@/app/api/portal/console/organization/members/[userId]/route');
const batchRoute = await import('@/app/api/portal/console/organization/members/batch/route');
const invitationsRoute = await import('@/app/api/portal/console/organization/invitations/route');
const invitationRoute =
  await import('@/app/api/portal/console/organization/invitations/[id]/route');
const requestsRoute = await import('@/app/api/portal/console/organization/quota-requests/route');
const requestRoute =
  await import('@/app/api/portal/console/organization/quota-requests/[id]/route');
const myQuotaRoute = await import('@/app/api/portal/console/organization/my-quota/route');

const ORIGIN = 'http://portal.test';
const DAY_MS = 86_400_000;

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

const userContext = (userId: string) => ({ params: Promise.resolve({ userId }) });
const idContext = (id: string) => ({ params: Promise.resolve({ id }) });

const RAW_MEMBER = {
  user_id: 5,
  email: 'dev@example.com',
  username: 'dev',
  status: 'disabled',
  is_owner: false,
  display_name: '',
  spending_limit: 20,
  spending_used: 0,
  spending_remaining: 20,
  joined_at: '2026-09-01T00:00:00Z',
};

const RAW_REQUEST = {
  id: 9,
  user_id: 5,
  amount: 20,
  status: 'granted',
  created_at: '2026-10-04T00:00:00Z',
};

beforeEach(() => {
  backend.calls.length = 0;
  backend.respond = () => ({ ok: true, data: null });
});

describe('组织概况与成员列表', () => {
  it('没登录 401、参数不对 400，都不问后端', async () => {
    const base = '/api/portal/console/organization';
    expect((await summaryRoute.GET(request(base, { cookie: '' }))).status).toBe(401);
    expect((await membersRoute.GET(request(`${base}/members?status=owner`))).status).toBe(400);
    expect(backend.calls).toEqual([]);
  });

  it('不在组织里时概况是 null；成员列表换成后端的参数名', async () => {
    const summary = await summaryRoute.GET(request('/api/portal/console/organization'));
    expect(await summary.json()).toEqual({ ok: true, organization: null });

    backend.respond = () => ({
      ok: true,
      data: { items: [RAW_MEMBER], total: 1, page: 1, page_size: 20 },
    });
    const members = await membersRoute.GET(
      request('/api/portal/console/organization/members?search=dev&status=disabled'),
    );
    expect(await members.json()).toMatchObject({
      ok: true,
      data: { total: 1, items: [{ userId: 5, status: 'disabled' }] },
    });
    expect(backend.calls.at(-1)?.path).toBe(
      '/organization/members?page=1&page_size=20&search=dev&status=disabled',
    );
  });

  it('不是组织管理员时回 403 owner_required', async () => {
    backend.respond = () => ({
      ok: false,
      error: { status: 403, reason: 'ORGANIZATION_OWNER_REQUIRED', message: '' },
    });
    const response = await membersRoute.GET(request('/api/portal/console/organization/members'));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      error: { reason: 'owner_required', status: 403 },
    });
  });
});

describe('改成员与批量操作', () => {
  it('别的网站发来的 403；请求体或地址不对 400', async () => {
    const path = '/api/portal/console/organization/members/5';
    const body = { kind: 'status', status: 'disabled' };
    expect(
      (
        await memberRoute.PATCH(
          request(path, { method: 'PATCH', body, origin: 'https://evil.test' }),
          userContext('5'),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await memberRoute.PATCH(
          request(path, {
            method: 'PATCH',
            body: { kind: 'status', status: 'gone' },
            origin: ORIGIN,
          }),
          userContext('5'),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await memberRoute.PATCH(
          request(path, { method: 'PATCH', body, origin: ORIGIN }),
          userContext('x'),
        )
      ).status,
    ).toBe(400);
    expect(backend.calls).toEqual([]);
  });

  it('停用成员走后端的状态接口（PUT），回改好的成员', async () => {
    backend.respond = () => ({ ok: true, data: RAW_MEMBER });
    const response = await memberRoute.PATCH(
      request('/api/portal/console/organization/members/5', {
        method: 'PATCH',
        body: { kind: 'status', status: 'disabled' },
        origin: ORIGIN,
      }),
      userContext('5'),
    );
    expect(await response.json()).toMatchObject({
      ok: true,
      member: { userId: 5, status: 'disabled' },
    });
    expect(backend.calls).toEqual([
      { method: 'PUT', path: '/organization/members/5/status', body: { status: 'disabled' } },
    ]);
  });

  it('平分上限换成后端的请求体', async () => {
    backend.respond = () => ({ ok: true, data: [RAW_MEMBER] });
    const response = await batchRoute.POST(
      request('/api/portal/console/organization/members/batch', {
        method: 'POST',
        body: { kind: 'split', userIds: [5, 7], totalAmount: 30 },
        origin: ORIGIN,
      }),
    );
    expect(await response.json()).toMatchObject({ ok: true, members: [{ userId: 5 }] });
    expect(backend.calls[0]).toEqual({
      method: 'POST',
      path: '/organization/members/spending-limit-split',
      body: { user_ids: [5, 7], total_amount: 30 },
    });
  });
});

describe('邀请码', () => {
  it('按天数算到期时间；长期有效不带到期时间', async () => {
    backend.respond = () => ({
      ok: true,
      data: { id: 3, code: 'ABCD', status: 'unused', created_at: '2026-10-04T00:00:00Z' },
    });
    const before = Date.now();
    const response = await invitationsRoute.POST(
      request('/api/portal/console/organization/invitations', {
        method: 'POST',
        body: { days: 7 },
        origin: ORIGIN,
      }),
    );
    expect(await response.json()).toMatchObject({ ok: true, invitation: { id: 3, code: 'ABCD' } });
    const sent = backend.calls[0]?.body as { expires_at: string };
    const expires = Date.parse(sent.expires_at);
    expect(expires).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
    expect(expires).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS);

    await invitationsRoute.POST(
      request('/api/portal/console/organization/invitations', {
        method: 'POST',
        body: { days: 0 },
        origin: ORIGIN,
      }),
    );
    expect(backend.calls[1]?.body).toEqual({});
  });

  it('有效期不在可选范围里 400；停用走 DELETE', async () => {
    expect(
      (
        await invitationsRoute.POST(
          request('/api/portal/console/organization/invitations', {
            method: 'POST',
            body: { days: 3 },
            origin: ORIGIN,
          }),
        )
      ).status,
    ).toBe(400);
    const response = await invitationRoute.DELETE(
      request('/api/portal/console/organization/invitations/3', {
        method: 'DELETE',
        origin: ORIGIN,
      }),
      idContext('3'),
    );
    expect(await response.json()).toEqual({ ok: true, done: true });
    expect(backend.calls).toEqual([
      { method: 'DELETE', path: '/organization/invitations/3', body: undefined },
    ]);
  });
});

describe('配额申请', () => {
  it('提交申请：理由为空时不带；处理申请：通过带备注，撤回不带请求体', async () => {
    backend.respond = () => ({ ok: true, data: RAW_REQUEST });
    await requestsRoute.POST(
      request('/api/portal/console/organization/quota-requests', {
        method: 'POST',
        body: { amount: 20, reason: '  ' },
        origin: ORIGIN,
      }),
    );
    await requestRoute.POST(
      request('/api/portal/console/organization/quota-requests/9', {
        method: 'POST',
        body: { action: 'approve', note: '' },
        origin: ORIGIN,
      }),
      idContext('9'),
    );
    await requestRoute.POST(
      request('/api/portal/console/organization/quota-requests/9', {
        method: 'POST',
        body: { action: 'withdraw' },
        origin: ORIGIN,
      }),
      idContext('9'),
    );
    expect(backend.calls).toEqual([
      { method: 'POST', path: '/organization/quota-requests', body: { amount: 20 } },
      { method: 'POST', path: '/organization/quota-requests/9/approve', body: { note: '' } },
      { method: 'POST', path: '/organization/quota-requests/9/withdraw', body: undefined },
    ]);
  });

  it('已处理过的申请回 409 request_handled', async () => {
    backend.respond = () => ({
      ok: false,
      error: { status: 409, reason: 'ORGANIZATION_QUOTA_REQUEST_NOT_PENDING', message: '' },
    });
    const response = await requestRoute.POST(
      request('/api/portal/console/organization/quota-requests/9', {
        method: 'POST',
        body: { action: 'reject', note: '预算用完了' },
        origin: ORIGIN,
      }),
      idContext('9'),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { reason: 'request_handled' },
    });
  });

  it('成员自己的组织配额从仪表盘统计里取，个人用户是 null', async () => {
    backend.respond = () => ({ ok: true, data: { total_requests: 3, organization_quota: null } });
    const personal = await myQuotaRoute.GET(request('/api/portal/console/organization/my-quota'));
    expect(await personal.json()).toEqual({ ok: true, quota: null });
    expect(backend.calls[0]?.path).toBe('/usage/dashboard/stats');

    backend.respond = () => ({
      ok: true,
      data: { organization_quota: { remaining: 4, can_request: true, request_mode: 'auto' } },
    });
    const member = await myQuotaRoute.GET(request('/api/portal/console/organization/my-quota'));
    expect(await member.json()).toMatchObject({
      ok: true,
      quota: { remaining: 4, canRequest: true, requestMode: 'auto' },
    });
  });
});
