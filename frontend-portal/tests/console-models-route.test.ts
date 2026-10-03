import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendCall } from '@/lib/server/sub2api/client';
import type { BackendResult } from '@/lib/server/sub2api/envelope';

/** 假的后端：按路径给结果，记下调用 */
const backend = vi.hoisted(() => ({
  calls: [] as string[],
  plaza: (() => ({ ok: true, data: { groups: [] } })) as () => BackendResult<unknown>,
  checkout: (() => ({
    ok: true,
    data: { balance_recharge_multiplier: 1 },
  })) as () => BackendResult<unknown>,
}));

vi.mock('@/lib/server/sub2api/client', () => ({
  callBackend: async (call: BackendCall) => {
    backend.calls.push(call.path);
    return call.path === '/model-plaza' ? backend.plaza() : backend.checkout();
  },
}));

const route = await import('@/app/api/portal/console/models/route');

function get(cookie = 'portal_at=token-1'): NextRequest {
  return new NextRequest('http://portal.test/api/portal/console/models', {
    headers: { host: 'portal.test', cookie },
  });
}

const GROUP = {
  id: 2,
  name: '标准通道',
  rate_multiplier: 0.15,
  models: [
    { name: 'gpt-5.5', platform: 'openai', pricing: { billing_mode: 'token', input_price: 5e-6 } },
  ],
};

beforeEach(() => {
  backend.calls.length = 0;
  backend.checkout = () => ({ ok: true, data: { balance_recharge_multiplier: 1 } });
});

describe('控制台模型接口', () => {
  it('没登录直接 401，不问后端', async () => {
    expect((await route.GET(get(''))).status).toBe(401);
    expect(backend.calls).toEqual([]);
  });

  it('读模型广场与充值比例，整理成通道列表', async () => {
    backend.plaza = () => ({ ok: true, data: { groups: [GROUP] } });
    backend.checkout = () => ({ ok: true, data: { balance_recharge_multiplier: 0.14 } });
    const response = await route.GET(get());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      rechargeMultiplier: 0.14,
      channels: [{ id: '2', name: '标准通道', rate: 0.15, models: [{ id: 'gpt-5.5' }] }],
    });
    expect(backend.calls.sort()).toEqual(['/model-plaza', '/payment/checkout-info']);
  });

  it('模型广场没打开（404）时当作没有可用模型；充值比例读不到按 1', async () => {
    backend.plaza = () => ({ ok: false, error: { status: 404, reason: 'NOT_FOUND', message: '' } });
    backend.checkout = () => ({ ok: false, error: { status: 500, reason: '', message: '' } });
    expect(await (await route.GET(get())).json()).toEqual({
      ok: true,
      channels: [],
      rechargeMultiplier: 1,
    });
  });

  it('后端出错按服务不可用处理', async () => {
    backend.plaza = () => ({ ok: false, error: { status: 500, reason: '', message: '' } });
    const response = await route.GET(get());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { reason: 'BACKEND_UNAVAILABLE' } });
  });
});
