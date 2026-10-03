import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendCall } from '@/lib/server/sub2api/client';
import type { BackendResult } from '@/lib/server/sub2api/envelope';

/** 假的后端：记下调用，按设定的结果返回 */
const backend = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; accessToken?: string }>,
  respond: (() => ({ ok: true, data: null })) as (call: BackendCall) => BackendResult<unknown>,
}));

vi.mock('@/lib/server/sub2api/client', () => ({
  callBackend: async (call: BackendCall) => {
    backend.calls.push({ path: call.path, accessToken: call.accessToken });
    return backend.respond(call);
  },
}));

const route = await import('@/app/api/portal/console/usage/route');

function get(search: string, cookie = 'portal_at=token-1'): NextRequest {
  return new NextRequest(`http://portal.test/api/portal/console/usage?${search}`, {
    headers: { host: 'portal.test', cookie },
  });
}

beforeEach(() => {
  backend.calls.length = 0;
});

describe('控制台用量接口', () => {
  it('带着访问凭证转给后端总览接口，结果换成浏览器用的形状', async () => {
    backend.respond = () => ({
      ok: true,
      data: {
        start_date: '2026-09-01',
        end_date: '2026-09-30',
        granularity: 'day',
        summary: { requests: 84, failed_requests: 0 },
        buckets: [],
        models: [],
        api_keys: [],
        groups: [],
      },
    });
    const response = await route.GET(get('from=2026-09-01&to=2026-09-30&detail=1'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      overview: { from: '2026-09-01', summary: { requests: 84, failedRequests: 0 } },
    });
    expect(backend.calls[0]?.accessToken).toBe('token-1');
    expect(backend.calls[0]?.path).toContain('/usage/dashboard/overview?');
    expect(backend.calls[0]?.path).toContain('dimensions=model%2Capi_key%2Cgroup');
  });

  it('参数不对直接 400，不问后端', async () => {
    const response = await route.GET(get('from=2026-09-30&to=2026-09-01'));
    expect(response.status).toBe(400);
    expect(backend.calls).toEqual([]);
  });

  it('没登录返回 401（参数不对也先报没登录）；后端说太频繁原样返回 429', async () => {
    expect((await route.GET(get('from=2026-09-01&to=2026-09-30', ''))).status).toBe(401);
    expect((await route.GET(get('', ''))).status).toBe(401);
    expect(backend.calls).toEqual([]);
    backend.respond = () => ({
      ok: false,
      error: { status: 429, reason: 'RATE_LIMITED', message: '' },
    });
    const response = await route.GET(get('from=2026-09-01&to=2026-09-30'));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { reason: 'TOO_MANY_REQUESTS' } });
  });

  it('后端返回看不懂的数据时按服务不可用处理', async () => {
    backend.respond = () => ({ ok: true, data: { summary: {} } });
    const response = await route.GET(get('from=2026-09-01&to=2026-09-30'));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { reason: 'BACKEND_UNAVAILABLE' } });
  });
});
