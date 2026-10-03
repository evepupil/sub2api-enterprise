import { describe, expect, it } from 'vitest';

import { callBackend } from '@/lib/server/sub2api/client';

/** 记下请求、按给定结果响应的假 fetch */
function fakeFetch(respond: () => Response | Promise<Response>) {
  const seen: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init: init ?? {} });
    return respond();
  }) as typeof fetch;
  return { impl, seen };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('官网服务器调后端', () => {
  it('拼出 /api/v1 地址，带上凭证、JSON 头和请求来源信息', async () => {
    const { impl, seen } = fakeFetch(() =>
      json(200, { code: 0, message: 'success', data: { ok: 1 } }),
    );
    const result = await callBackend(
      {
        method: 'POST',
        path: '/auth/login',
        body: { email: 'a@b.test' },
        accessToken: 'tok',
        forwarded: new Headers({ 'x-forwarded-for': '203.0.113.9' }),
      },
      { fetchImpl: impl, origin: 'http://backend.internal:8080' },
    );

    expect(result).toEqual({ ok: true, data: { ok: 1 } });
    expect(seen[0]?.url).toBe('http://backend.internal:8080/api/v1/auth/login');
    const headers = new Headers(seen[0]?.init.headers);
    expect(headers.get('authorization')).toBe('Bearer tok');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.9');
    expect(seen[0]?.init.body).toBe(JSON.stringify({ email: 'a@b.test' }));
  });

  it('后端返回错误：带回状态码与错误代码', async () => {
    const { impl } = fakeFetch(() =>
      json(401, { code: 401, message: 'invalid email or password', reason: 'INVALID_CREDENTIALS' }),
    );
    const result = await callBackend(
      { method: 'POST', path: '/auth/login', body: {}, forwarded: new Headers() },
      { fetchImpl: impl, origin: 'http://b' },
    );
    expect(result).toMatchObject({
      ok: false,
      error: { status: 401, reason: 'INVALID_CREDENTIALS' },
    });
  });

  it('连不上后端或超时：按 503 后端不可用', async () => {
    const { impl } = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    const result = await callBackend(
      { method: 'GET', path: '/auth/me', forwarded: new Headers() },
      { fetchImpl: impl, origin: 'http://b' },
    );
    expect(result).toMatchObject({
      ok: false,
      error: { status: 503, reason: 'PORTAL_BACKEND_UNAVAILABLE' },
    });
  });

  it('没配后端地址：按 503 未配置，不发请求', async () => {
    const { impl, seen } = fakeFetch(() => json(200, {}));
    const result = await callBackend(
      { method: 'GET', path: '/auth/me', forwarded: new Headers() },
      { fetchImpl: impl, origin: null },
    );
    expect(result).toMatchObject({
      ok: false,
      error: { status: 503, reason: 'PORTAL_BACKEND_NOT_CONFIGURED' },
    });
    expect(seen).toEqual([]);
  });
});
