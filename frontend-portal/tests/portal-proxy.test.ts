import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forwardPortalRequest, isAllowedPortalRequest } from '../src/lib/api/portal-proxy';

const BASE_URL = 'https://internal.example.test';
const MAX_BODY_BYTES = 1024 * 1024;

type FetchCall = {
  input: string;
  init: RequestInit;
};

type FetchHandler = (input: string, init: RequestInit) => Response | Promise<Response>;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function makeFetcher(handler: FetchHandler = () => jsonResponse({ ok: true })): {
  fetcher: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const normalizedInit = init ?? {};
    calls.push({ input: String(input), init: normalizedInit });
    return handler(String(input), normalizedInit);
  }) as typeof fetch;
  return { fetcher, calls };
}

function makeRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`https://portal.example.test${path}`, init);
}

function getHeader(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

function makeJsonBody(size: number): string {
  const prefix = '{"value":"';
  const suffix = '"}';
  return `${prefix}${'x'.repeat(size - prefix.length - suffix.length)}${suffix}`;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function flushMany(): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve();
  }
}

describe('isAllowedPortalRequest', () => {
  it.each([
    ['GET', ['settings', 'public']],
    ['GET', ['auth', 'me']],
    ['GET', ['keys', '1']],
    ['GET', ['payment', 'orders', '42']],
    ['GET', ['user', 'api-keys', '7', 'usage', 'daily']],
    ['POST', ['auth', 'login']],
    ['POST', ['auth', 'passkey', 'login', 'begin']],
    ['POST', ['auth', 'oauth', 'github', 'start']],
    ['POST', ['auth', 'oauth', 'oidc', 'complete-registration']],
    ['POST', ['payment', 'orders', '42', 'cancel']],
    ['PUT', ['user']],
    ['PUT', ['keys', '9']],
    ['DELETE', ['keys', '9']],
  ])('allows %s %s', (method, pathSegments) => {
    expect(isAllowedPortalRequest(method, pathSegments)).toBe(true);
  });

  it.each([
    ['GET', ['admin']],
    ['POST', ['setup']],
    ['POST', ['payment', 'webhook']],
    ['POST', ['inference']],
    ['GET', ['keys', '0']],
    ['GET', ['keys', '01']],
    ['GET', ['keys', '1.0']],
    ['GET', ['keys', '-1']],
    ['GET', ['keys', '1a']],
    ['GET', ['keys', '%2e%2e']],
    ['GET', ['keys', '%2F']],
    ['GET', ['keys', 'a/b']],
    ['GET', ['keys', 'a\\b']],
    ['GET', ['keys', '?next=admin']],
    ['GET', ['..', 'admin']],
    ['GET', ['auth', 'me', 'extra']],
    ['PATCH', ['user']],
  ])('rejects %s %s', (method, pathSegments) => {
    expect(isAllowedPortalRequest(method, pathSegments)).toBe(false);
  });
});

describe('forwardPortalRequest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('forwards only allow-listed routes to the fixed origin and preserves query text', async () => {
    const { fetcher, calls } = makeFetcher();
    const response = await forwardPortalRequest(
      makeRequest('/api/portal/auth/me?cursor=2&search=a+b'),
      ['auth', 'me'],
      { baseUrl: `${BASE_URL}/`, fetcher },
    );

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(`${BASE_URL}/api/v1/auth/me?cursor=2&search=a+b`);
    expect(calls[0]?.init.cache).toBe('no-store');
    expect(calls[0]?.init.redirect).toBe('error');
  });

  it('uses publicOrigin for write origin checks and the forwarded Referer', async () => {
    const { fetcher, calls } = makeFetcher();
    const response = await forwardPortalRequest(
      new Request('https://internal.example.test/api/portal/auth/login', {
        method: 'POST',
        headers: {
          origin: 'https://portal.example.test',
          'content-type': 'application/json',
        },
        body: '{}',
      }),
      ['auth', 'login'],
      {
        baseUrl: BASE_URL,
        publicOrigin: 'https://portal.example.test',
        fetcher,
      },
    );

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(getHeader(calls[0]!.init, 'referer')).toBe('https://portal.example.test/');
  });

  it('rejects a write whose Origin differs from publicOrigin', async () => {
    const { fetcher, calls } = makeFetcher();
    const response = await forwardPortalRequest(
      new Request('https://internal.example.test/api/portal/auth/login', {
        method: 'POST',
        headers: {
          origin: 'https://attacker.example',
          'content-type': 'application/json',
        },
        body: '{}',
      }),
      ['auth', 'login'],
      {
        baseUrl: BASE_URL,
        publicOrigin: 'https://portal.example.test',
        fetcher,
      },
    );

    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('returns 503 for an invalid publicOrigin before calling the backend', async () => {
    const { fetcher, calls } = makeFetcher();
    const response = await forwardPortalRequest(
      new Request('https://internal.example.test/api/portal/auth/me'),
      ['auth', 'me'],
      {
        baseUrl: BASE_URL,
        publicOrigin: 'https://portal.example.test/console',
        fetcher,
      },
    );

    expect(response.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it.each([
    undefined,
    '',
    'ftp://internal.example.test',
    'https://internal.example.test/api',
    'https://user:pass@internal.example.test',
    'https://internal.example.test?secret=1',
    'https://internal.example.test#fragment',
  ])('returns 503 and does not fetch when baseUrl is invalid: %s', async (baseUrl) => {
    const { fetcher, calls } = makeFetcher();
    const response = await forwardPortalRequest(
      makeRequest('/api/portal/auth/me'),
      ['auth', 'me'],
      {
        ...(baseUrl === undefined ? {} : { baseUrl }),
        fetcher,
      },
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toContain('服务暂时不可用');
    expect(calls).toHaveLength(0);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('rejects a disallowed path before calling the backend', async () => {
    const { fetcher, calls } = makeFetcher();
    const response = await forwardPortalRequest(
      makeRequest('/api/portal/admin/setup'),
      ['admin', 'setup'],
      { baseUrl: BASE_URL, fetcher },
    );

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(BASE_URL);
    expect(calls).toHaveLength(0);
  });

  it('allows a same-origin write and rejects a cross-origin write', async () => {
    const sameOrigin = makeFetcher();
    const sameOriginResponse = await forwardPortalRequest(
      makeRequest('/api/portal/auth/login', {
        method: 'POST',
        headers: { origin: 'https://portal.example.test', 'content-type': 'application/json' },
        body: '{}',
      }),
      ['auth', 'login'],
      { baseUrl: BASE_URL, fetcher: sameOrigin.fetcher },
    );
    expect(sameOriginResponse.status).toBe(200);
    expect(sameOrigin.calls).toHaveLength(1);

    const crossOrigin = makeFetcher();
    const crossOriginResponse = await forwardPortalRequest(
      makeRequest('/api/portal/auth/login', {
        method: 'POST',
        headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
        body: '{}',
      }),
      ['auth', 'login'],
      { baseUrl: BASE_URL, fetcher: crossOrigin.fetcher },
    );
    expect(crossOriginResponse.status).toBe(403);
    expect(crossOrigin.calls).toHaveLength(0);
  });

  it('forwards JSON bodies up to 1 MiB and rejects non-JSON or larger bodies', async () => {
    const body = makeJsonBody(MAX_BODY_BYTES);
    const accepted = makeFetcher();
    const acceptedResponse = await forwardPortalRequest(
      makeRequest('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body,
      }),
      ['auth', 'login'],
      { baseUrl: BASE_URL, fetcher: accepted.fetcher },
    );
    expect(acceptedResponse.status).toBe(200);
    expect(accepted.calls).toHaveLength(1);
    expect(accepted.calls[0]?.init.body).toBe(body);

    const nonJson = makeFetcher();
    const nonJsonResponse = await forwardPortalRequest(
      makeRequest('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'not json',
      }),
      ['auth', 'login'],
      { baseUrl: BASE_URL, fetcher: nonJson.fetcher },
    );
    expect(nonJsonResponse.status).toBe(415);
    expect(nonJson.calls).toHaveLength(0);

    const tooLarge = makeFetcher();
    const tooLargeResponse = await forwardPortalRequest(
      makeRequest('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: makeJsonBody(MAX_BODY_BYTES + 1),
      }),
      ['auth', 'login'],
      { baseUrl: BASE_URL, fetcher: tooLarge.fetcher },
    );
    expect(tooLargeResponse.status).toBe(413);
    expect(tooLarge.calls).toHaveLength(0);
  });

  it('forwards authorization and selected OAuth cookies while dropping other headers and cookies', async () => {
    const { fetcher, calls } = makeFetcher();
    const response = await forwardPortalRequest(
      makeRequest('/api/portal/auth/login', {
        method: 'POST',
        headers: {
          authorization: 'Bearer current-token',
          'content-type': 'application/json',
          'user-agent': 'portal-test',
          'idempotency-key': 'request-1',
          host: 'attacker-host.example',
          cookie:
            'oauth_state=one; session=secret; email_oauth_nonce=two; linuxdo_oauth_x=three; oidc_oauth_y=four; wechat_oauth_z=five; dingtalk_oauth_q=six; ignored=value',
        },
        body: '{}',
      }),
      ['auth', 'login'],
      { baseUrl: BASE_URL, fetcher },
    );

    expect(response.status).toBe(200);
    const init = calls[0]?.init;
    expect(init).toBeDefined();
    expect(getHeader(init!, 'authorization')).toBe('Bearer current-token');
    expect(getHeader(init!, 'content-type')).toBe('application/json');
    expect(getHeader(init!, 'user-agent')).toBe('portal-test');
    expect(getHeader(init!, 'idempotency-key')).toBe('request-1');
    expect(getHeader(init!, 'cookie')).toBe(
      'oauth_state=one; email_oauth_nonce=two; linuxdo_oauth_x=three; oidc_oauth_y=four; wechat_oauth_z=five; dingtalk_oauth_q=six',
    );
    expect(getHeader(init!, 'host')).toBeNull();
    expect(getHeader(init!, 'content-length')).toBeNull();
  });

  it('always derives the upstream Referer from request.url origin and never forwards a cross-site Referer', async () => {
    const { fetcher, calls } = makeFetcher((input) => {
      if (input.endsWith('/auth/me')) {
        return jsonResponse({ code: 0, data: { id: 1, organization: null } });
      }
      return jsonResponse({ ok: true });
    });
    const response = await forwardPortalRequest(
      makeRequest('/api/portal/payment/orders', {
        method: 'POST',
        headers: {
          origin: 'https://portal.example.test',
          authorization: 'Bearer current-token',
          'content-type': 'application/json',
          referer: 'https://attacker.example/console/billing',
        },
        body: '{}',
      }),
      ['payment', 'orders'],
      { baseUrl: BASE_URL, fetcher },
    );

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.input).toBe(`${BASE_URL}/api/v1/auth/me`);
    expect(calls[1]?.input).toBe(`${BASE_URL}/api/v1/payment/orders`);
    expect(getHeader(calls[0]!.init, 'authorization')).toBe('Bearer current-token');
    expect(getHeader(calls[1]!.init, 'authorization')).toBe('Bearer current-token');
    expect(getHeader(calls[0]!.init, 'referer')).toBe('https://portal.example.test/');
    expect(getHeader(calls[1]!.init, 'referer')).toBe('https://portal.example.test/');
    expect(getHeader(calls[0]!.init, 'referer')).not.toContain('attacker.example');
    expect(getHeader(calls[1]!.init, 'referer')).not.toContain('attacker.example');
  });

  it('rewrites response cookies to the portal path and strips backend domains', async () => {
    const upstream = jsonResponse({ ok: true });
    upstream.headers.append(
      'set-cookie',
      'oauth_state=abc; Path=/api/v1/auth; Domain=internal.example.test; HttpOnly; SameSite=Lax',
    );
    upstream.headers.append(
      'set-cookie',
      'csrf=token; Path=/api/v1; Domain=internal.example.test; Secure',
    );
    const { fetcher } = makeFetcher(() => upstream);
    const response = await forwardPortalRequest(
      makeRequest('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      ['auth', 'login'],
      { baseUrl: BASE_URL, fetcher },
    );

    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain('Path=/api/portal/auth');
    expect(cookies[1]).toContain('Path=/api/portal');
    expect(cookies.join(';')).not.toMatch(/Domain=/iu);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('sets redirect:error so an upstream redirect cannot be followed', async () => {
    const { fetcher, calls } = makeFetcher((_input, init) => {
      expect(init.redirect).toBe('error');
      return new Response(null, { status: 302, headers: { location: 'https://outside.example' } });
    });

    const response = await forwardPortalRequest(
      makeRequest('/api/portal/auth/me'),
      ['auth', 'me'],
      { baseUrl: BASE_URL, fetcher },
    );

    expect(response.status).toBe(302);
    expect(calls).toHaveLength(1);
  });

  it('times out while reading an upstream response body', async () => {
    const body = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
    });
    const { fetcher } = makeFetcher(() =>
      Promise.resolve(
        new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }),
      ),
    );
    const pending = forwardPortalRequest(makeRequest('/api/portal/auth/me'), ['auth', 'me'], {
      baseUrl: BASE_URL,
      fetcher,
      timeoutMs: 10,
    });

    await flushMany();
    await vi.advanceTimersByTimeAsync(10);
    const response = await pending;

    expect(response.status).toBe(504);
    expect(await response.text()).toContain('请求超时');
  });

  it('propagates caller abort and cancels the upstream request without accepting a late response', async () => {
    const upstream = deferred<Response>();
    let upstreamSignal: AbortSignal | undefined;
    const { fetcher } = makeFetcher((_input, init) => {
      upstreamSignal = init.signal ?? undefined;
      return upstream.promise;
    });
    const controller = new AbortController();
    const reason = new DOMException('caller aborted', 'AbortError');
    const pending = forwardPortalRequest(
      makeRequest('/api/portal/auth/me', {
        signal: controller.signal,
        headers: { authorization: 'Bearer current-token' },
      }),
      ['auth', 'me'],
      { baseUrl: BASE_URL, fetcher },
    );

    await flushMany();
    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
    expect(upstreamSignal?.aborted).toBe(true);

    upstream.resolve(jsonResponse({ stale: true }));
    await flushMany();
    expect(upstreamSignal?.aborted).toBe(true);
  });

  it('returns private safe errors without exposing backend exceptions or its base URL', async () => {
    const internalError = new Error(`backend failed at ${BASE_URL}/private-secret`);
    const { fetcher } = makeFetcher(() => Promise.reject(internalError));
    const response = await forwardPortalRequest(
      makeRequest('/api/portal/auth/me'),
      ['auth', 'me'],
      { baseUrl: BASE_URL, fetcher },
    );

    const body = await response.text();
    expect(response.status).toBe(502);
    expect(body).toContain('服务暂时不可用');
    expect(body).not.toContain('backend failed');
    expect(body).not.toContain(BASE_URL);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('limits an oversized upstream response body and keeps the response safe', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(MAX_BODY_BYTES + 1)));
        controller.close();
      },
    });
    const { fetcher } = makeFetcher(() => new Response(body, { status: 200 }));
    const response = await forwardPortalRequest(
      makeRequest('/api/portal/auth/me'),
      ['auth', 'me'],
      {
        baseUrl: BASE_URL,
        fetcher,
      },
    );

    expect(response.status).toBe(502);
    expect(await response.text()).toContain('服务返回内容过大');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
