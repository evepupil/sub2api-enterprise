import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendCall, BackendClientOptions } from '@/lib/server/sub2api/client';
import type { BackendResult } from '@/lib/server/sub2api/envelope';

/** 假的后端：按路径给结果，记下调用和等待上限；缓存直接透传，只测读数与出错的处理 */
const backend = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; timeoutMs?: number }>,
  plaza: (() => ({ ok: true, data: { groups: [] } })) as () => BackendResult<unknown>,
  status: (() => ({ ok: true, data: { items: [] } })) as () => BackendResult<unknown>,
}));

vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.mock('@/lib/server/sub2api/client', () => ({
  callBackend: async (call: BackendCall, options: BackendClientOptions = {}) => {
    backend.calls.push({ path: call.path, timeoutMs: options.timeoutMs });
    return call.path === '/model-plaza' ? backend.plaza() : backend.status();
  },
}));

const { getSiteCatalog, isTransientFailure, settle, SITE_BACKEND_TIMEOUT_MS } =
  await import('@/lib/server/site-catalog');

const PLAZA = {
  groups: [
    {
      id: 1,
      name: '标准通道',
      rate_multiplier: 0.15,
      models: [
        {
          name: 'gpt-5.5',
          platform: 'openai',
          pricing: { billing_mode: 'token', input_price: 5e-6 },
        },
      ],
    },
  ],
};
const fail = (status: number) => (): BackendResult<unknown> => ({
  ok: false,
  error: { status, reason: 'X', message: '' },
});

beforeEach(() => {
  backend.calls.length = 0;
  backend.plaza = () => ({ ok: true, data: PLAZA });
  backend.status = () => ({ ok: true, data: { items: [] } });
});

describe('官网模型数据', () => {
  it('超时、连不上、5xx、限流算临时出错；其余（如功能没打开的 404）不算', () => {
    for (const status of [0, 429, 500, 502, 503]) {
      expect(isTransientFailure({ status, reason: '', message: '' })).toBe(true);
    }
    for (const status of [400, 401, 404]) {
      expect(isTransientFailure({ status, reason: '', message: '' })).toBe(false);
    }
  });

  it('临时出错时抛出（不进缓存），功能没打开时当作没有数据（照常缓存）', () => {
    const convert = () => ['converted'];
    expect(settle({ ok: true, data: {} }, convert)).toEqual(['converted']);
    expect(() => settle(fail(503)(), convert)).toThrow();
    expect(settle(fail(404)(), convert)).toBeNull();
  });

  it('每次最多等 5 秒', async () => {
    await getSiteCatalog();
    expect(backend.calls.map((call) => call.timeoutMs)).toEqual([
      SITE_BACKEND_TIMEOUT_MS,
      SITE_BACKEND_TIMEOUT_MS,
    ]);
    expect(SITE_BACKEND_TIMEOUT_MS).toBe(5_000);
  });

  it('模型广场临时出错时页面为空；可用率读不到时照常显示价格', async () => {
    backend.plaza = fail(503);
    expect(await getSiteCatalog()).toBeNull();
    backend.plaza = () => ({ ok: true, data: PLAZA });
    backend.status = fail(503);
    const catalog = await getSiteCatalog();
    expect(catalog?.map((model) => model.id)).toEqual(['gpt-5.5']);
    expect(catalog?.[0]?.health).toBeNull();
  });
});
