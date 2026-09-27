/**
 * M1 公开数据请求（public-client）业务规则测试。
 *
 * 契约来源：design/public-site.md 第 2、3 节；类型见 src/features/public/types.ts。
 * 只验证传输边界（固定路径、请求选项、状态码、业务包装、网络与超时），
 * 不启动 HTTP 服务、不访问生产接口、不渲染任何 UI。
 *
 * 事实（任务书与设计文档）：
 * - 只请求 /api/v1/settings/public、/api/v1/model-plaza、/api/v1/status 三条固定路径。
 * - baseUrl 必须是 http/https、无 userinfo/查询/hash、路径为根的 origin；
 *   缺失或非法时返回 unavailable 且不调用 fetch。
 * - 不转发 cookie/Authorization（credentials omit，不设置鉴权头）。
 * - redirect: error、cache: no-store、默认超时 5 秒。
 * - 401/403 → authentication-required；404 → disabled；其余非 2xx → unavailable。
 * - 正确包装为 {code:0,data:...}；非 0、缺 data、非对象包装、非法 JSON → unavailable。
 * - 网络 reject、fetch 挂起、响应体解析挂起 → unavailable，且超时后及时返回。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchPublicData } from '../src/lib/api/public-client';
import type { PublicEndpoint } from '../src/lib/api/public-client';

const ORIGIN = 'https://backend.example.com';

interface FetchCall {
  input: RequestInfo | URL;
  init: RequestInit | undefined;
}

type Responder = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** 可注入的 fetch stub：记录每次调用参数，并返回给定响应。 */
function stubFetcher(responder: Responder): { fetcher: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetcher: typeof fetch = (input, init) => {
    calls.push({ input, init });
    return responder(input, init);
  };
  return { fetcher, calls };
}

/** 返回一个 JSON 业务包装响应，并记录调用参数。 */
function jsonFetcher(body: unknown, status = 200): { fetcher: typeof fetch; calls: FetchCall[] } {
  return stubFetcher(async () => new Response(JSON.stringify(body), { status }));
}

/** 断言恰好调用一次并返回该次调用参数。 */
function onlyCall(calls: FetchCall[]): FetchCall {
  expect(calls).toHaveLength(1);
  const call = calls[0];
  if (!call) {
    throw new Error('fetcher 未被调用');
  }
  return call;
}

const ENDPOINTS: readonly PublicEndpoint[] = ['settings', 'catalog', 'status'];

const EXPECTED_PATH: Record<PublicEndpoint, string> = {
  settings: '/api/v1/settings/public',
  catalog: '/api/v1/model-plaza',
  status: '/api/v1/status',
};

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchPublicData 固定端点路径', () => {
  it.each(ENDPOINTS)('%s 请求固定的后端路径', async (endpoint) => {
    const { fetcher, calls } = jsonFetcher({ code: 0, data: { ok: true } });

    const result = await fetchPublicData(endpoint, { baseUrl: ORIGIN, fetcher });

    expect(String(onlyCall(calls).input)).toBe(`${ORIGIN}${EXPECTED_PATH[endpoint]}`);
    expect(result).toEqual({ kind: 'ready', data: { ok: true } });
  });

  it('不提供拼接任意路径的能力：不同端点互不串用', async () => {
    for (const endpoint of ENDPOINTS) {
      const { fetcher, calls } = jsonFetcher({ code: 0, data: null });
      await fetchPublicData(endpoint, { baseUrl: ORIGIN, fetcher });
      const url = String(onlyCall(calls).input);
      expect(url.endsWith(EXPECTED_PATH[endpoint]), url).toBe(true);
      for (const other of ENDPOINTS) {
        if (other === endpoint) continue;
        expect(url.endsWith(EXPECTED_PATH[other]), url).toBe(false);
      }
    }
  });
});

describe('fetchPublicData 请求边界', () => {
  it('GET 且 credentials 为 omit，不携带 Authorization/Cookie', async () => {
    const { fetcher, calls } = jsonFetcher({ code: 0, data: {} });

    await fetchPublicData('settings', { baseUrl: ORIGIN, fetcher });

    const { init } = onlyCall(calls);
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('omit');
    const headers = new Headers(init?.headers);
    expect(headers.has('authorization')).toBe(false);
    expect(headers.has('cookie')).toBe(false);
  });

  it('redirect 为 error', async () => {
    const { fetcher, calls } = jsonFetcher({ code: 0, data: {} });

    await fetchPublicData('status', { baseUrl: ORIGIN, fetcher });

    expect(onlyCall(calls).init?.redirect).toBe('error');
  });

  it('cache 为 no-store', async () => {
    const { fetcher, calls } = jsonFetcher({ code: 0, data: {} });

    await fetchPublicData('catalog', { baseUrl: ORIGIN, fetcher });

    expect(onlyCall(calls).init?.cache).toBe('no-store');
  });

  it('把 abort signal 交给 fetch（超时可中断请求）', async () => {
    const { fetcher, calls } = jsonFetcher({ code: 0, data: {} });

    await fetchPublicData('status', { baseUrl: ORIGIN, fetcher });

    expect(onlyCall(calls).init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('fetchPublicData origin 校验', () => {
  const INVALID_ORIGINS: readonly (string | undefined)[] = [
    undefined,
    '',
    '   ',
    'not-a-url',
    'ftp://backend.example.com',
    'https://user:pass@backend.example.com',
    'https://backend.example.com/path',
    'https://backend.example.com?query=1',
    'https://backend.example.com#hash',
    '//backend.example.com',
  ];

  it.each(INVALID_ORIGINS)(
    '缺失或非法 origin（%s）返回 unavailable 且不发请求',
    async (baseUrl) => {
      const { fetcher, calls } = jsonFetcher({ code: 0, data: {} });

      const result = await fetchPublicData('settings', { baseUrl, fetcher });

      expect(result).toEqual({ kind: 'unavailable' });
      expect(calls).toHaveLength(0);
    },
  );

  it.each(['https://backend.example.com', 'https://backend.example.com/', 'http://localhost:8080'])(
    '合法 origin（%s）会发出请求',
    async (baseUrl) => {
      const { fetcher, calls } = jsonFetcher({ code: 0, data: {} });

      const result = await fetchPublicData('settings', { baseUrl, fetcher });

      expect(result).toEqual({ kind: 'ready', data: {} });
      expect(calls).toHaveLength(1);
    },
  );
});

describe('fetchPublicData HTTP 状态映射', () => {
  it.each([401, 403])('%i 返回 authentication-required', async (status) => {
    const { fetcher } = stubFetcher(async () => new Response(null, { status }));

    const result = await fetchPublicData('status', { baseUrl: ORIGIN, fetcher });

    expect(result).toEqual({ kind: 'authentication-required' });
  });

  it('404 返回 disabled', async () => {
    const { fetcher } = stubFetcher(async () => new Response(null, { status: 404 }));

    const result = await fetchPublicData('catalog', { baseUrl: ORIGIN, fetcher });

    expect(result).toEqual({ kind: 'disabled' });
  });

  it.each([500, 502, 429])('%i 返回 unavailable', async (status) => {
    const { fetcher } = stubFetcher(async () => new Response(null, { status }));

    const result = await fetchPublicData('catalog', { baseUrl: ORIGIN, fetcher });

    expect(result).toEqual({ kind: 'unavailable' });
  });
});

describe('fetchPublicData 业务包装', () => {
  it('code 0 时返回 data', async () => {
    const { fetcher } = jsonFetcher({ code: 0, data: { site_name: '模型服务' } });

    const result = await fetchPublicData('settings', { baseUrl: ORIGIN, fetcher });

    expect(result).toEqual({ kind: 'ready', data: { site_name: '模型服务' } });
  });

  it.each([
    ['code 非 0', { code: 1, data: { a: 1 } }],
    ['code 为字符串 0', { code: '0', data: { a: 1 } }],
    ['缺少 data', { code: 0 }],
    ['data 为 undefined', { code: 0, data: undefined }],
    ['payload 为 null', null],
    ['payload 为数组', [{ code: 0, data: {} }]],
    ['payload 为字符串', 'ok'],
    ['payload 为数字', 42],
    ['payload 为布尔', true],
  ])('%s 返回 unavailable', async (_label, body) => {
    const { fetcher } = jsonFetcher(body);

    const result = await fetchPublicData('settings', { baseUrl: ORIGIN, fetcher });

    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('非法 JSON 返回 unavailable', async () => {
    const { fetcher } = stubFetcher(
      async () =>
        new Response('not-json', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const result = await fetchPublicData('status', { baseUrl: ORIGIN, fetcher });

    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('空响应体返回 unavailable', async () => {
    const { fetcher } = stubFetcher(async () => new Response('', { status: 200 }));

    const result = await fetchPublicData('status', { baseUrl: ORIGIN, fetcher });

    expect(result).toEqual({ kind: 'unavailable' });
  });
});

describe('fetchPublicData 网络失败与超时', () => {
  it('fetch reject 返回 unavailable', async () => {
    const { fetcher } = stubFetcher(async () => {
      throw new Error('network down');
    });

    const result = await fetchPublicData('status', { baseUrl: ORIGIN, fetcher });

    expect(result).toEqual({ kind: 'unavailable' });
  });

  it('fetch 挂起时在 timeoutMs 后返回 unavailable，不早退', async () => {
    vi.useFakeTimers();
    const { fetcher, calls } = stubFetcher(() => new Promise<Response>(() => {}));

    const promise = fetchPublicData('status', { baseUrl: ORIGIN, fetcher, timeoutMs: 5000 });
    let settled = false;
    void promise.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(4999);
    expect(settled, '未到超时不应返回').toBe(false);
    expect(calls).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ kind: 'unavailable' });
    expect(settled).toBe(true);
  });

  it('响应体解析挂起时在 timeoutMs 后返回 unavailable', async () => {
    vi.useFakeTimers();
    const response = new Response('{}', { status: 200 });
    Object.defineProperty(response, 'json', {
      value: () => new Promise<unknown>(() => {}),
    });
    const { fetcher } = stubFetcher(async () => response);

    const promise = fetchPublicData('catalog', { baseUrl: ORIGIN, fetcher, timeoutMs: 5000 });
    let settled = false;
    void promise.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(4999);
    expect(settled, '未到超时不应返回').toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual({ kind: 'unavailable' });
    expect(settled).toBe(true);
  });

  it('使用真实计时器时挂起的 fetch 也会按时返回（短超时）', async () => {
    const { fetcher } = stubFetcher(() => new Promise<Response>(() => {}));

    const result = await fetchPublicData('status', { baseUrl: ORIGIN, fetcher, timeoutMs: 10 });

    expect(result).toEqual({ kind: 'unavailable' });
  });
});
