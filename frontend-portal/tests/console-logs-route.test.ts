import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendCall } from '@/lib/server/sub2api/client';
import type { BackendResult } from '@/lib/server/sub2api/envelope';

/** 假的后端：记下调用路径，按路径给结果 */
const backend = vi.hoisted(() => ({
  calls: [] as string[],
  respond: (() => ({ ok: true, data: null })) as (path: string) => BackendResult<unknown>,
}));

vi.mock('@/lib/server/sub2api/client', () => ({
  callBackend: async (call: BackendCall) => {
    backend.calls.push(call.path);
    return backend.respond(call.path);
  },
}));

const listRoute = await import('@/app/api/portal/console/logs/route');
const optionsRoute = await import('@/app/api/portal/console/logs/options/route');
const exportRoute = await import('@/app/api/portal/console/logs/export/route');

function get(path: string, cookie = 'portal_at=token-1'): NextRequest {
  return new NextRequest(`http://portal.test${path}`, { headers: { host: 'portal.test', cookie } });
}

const record = (id: number) => ({
  id,
  api_key_id: 7,
  request_id: `req_${id}`,
  model: 'gpt-5.4',
  created_at: '2026-10-04T07:05:34Z',
  input_tokens: 10,
  output_tokens: 5,
  actual_cost: 0.001,
  total_cost: 0.002,
  rate_multiplier: 0.5,
  api_key: { id: 7, name: 'prod', key: 'sk-secret-should-not-leak' },
});

beforeEach(() => {
  backend.calls.length = 0;
});

describe('日志列表接口', () => {
  it('没登录直接 401；参数不对 400；都不问后端', async () => {
    expect(
      (await listRoute.GET(get('/api/portal/console/logs?from=2026-09-01&to=2026-09-30', '')))
        .status,
    ).toBe(401);
    expect(
      (await listRoute.GET(get('/api/portal/console/logs?from=bad&to=2026-09-30'))).status,
    ).toBe(400);
    expect(backend.calls).toEqual([]);
  });

  it('转给后端使用记录列表，只回页面要用的字段', async () => {
    backend.respond = () => ({
      ok: true,
      data: { items: [record(1)], total: 1, page: 1, page_size: 20, pages: 1 },
    });
    const response = await listRoute.GET(
      get('/api/portal/console/logs?from=2026-09-01&to=2026-09-30&key=7&pageSize=20'),
    );
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({ ok: true, total: 1, items: [{ id: 1, key: { name: 'prod' } }] });
    expect(JSON.stringify(body)).not.toContain('sk-secret');
    expect(backend.calls[0]).toContain('/usage?');
    expect(backend.calls[0]).toContain('api_key_id=7');
  });
});

describe('筛选选项接口', () => {
  it('同时读密钥与用过的模型；其中一项读不到就让那一项为空', async () => {
    backend.respond = (path) =>
      path.startsWith('/keys')
        ? { ok: true, data: { items: [{ id: 7, name: 'prod', key: 'sk-secret' }] } }
        : { ok: false, error: { status: 500, reason: '', message: '' } };
    const response = await optionsRoute.GET(
      get('/api/portal/console/logs/options?from=2026-09-01&to=2026-09-30'),
    );
    expect(await response.json()).toEqual({
      ok: true,
      keys: [{ id: 7, name: 'prod' }],
      models: [],
    });
  });
});

describe('导出接口', () => {
  it('分页把记录要全（不足一页就停），拼成带 UTF-8 标记的 CSV', async () => {
    backend.respond = (path) => {
      const page = Number(new URL(`http://x${path}`).searchParams.get('page'));
      const items =
        page === 1 ? Array.from({ length: 1000 }, (_, i) => record(i + 1)) : [record(9999)];
      return { ok: true, data: { items, total: 1001, page, page_size: 1000 } };
    };
    const response = await exportRoute.GET(
      get('/api/portal/console/logs/export?from=2026-09-01&to=2026-09-30&locale=en'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toContain('logs-2026-09-01-2026-09-30.csv');
    const text = await response.text();
    // response.text() 会吃掉开头的 UTF-8 标记，所以按字节检查
    const bytes = new Uint8Array(
      await (
        await exportRoute.GET(
          get('/api/portal/console/logs/export?from=2026-09-01&to=2026-09-30&locale=en'),
        )
      ).arrayBuffer(),
    );
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const lines = text.trim().split('\r\n');
    expect(lines[0]?.startsWith('Time,Request ID,API key,Group,Multiplier')).toBe(true);
    expect(lines).toHaveLength(1 + 1001);
    expect(text).not.toContain('sk-secret');
    expect(backend.calls.filter((path) => path.startsWith('/usage?')).length).toBe(4);
  });
});
