import { describe, expect, it } from 'vitest';
import { forwardOAuthCallback } from '../src/lib/api/oauth-callback-proxy';

const BASE_URL = 'https://internal.example.test';
const PUBLIC_ORIGIN = 'https://portal.example.test';

type FetchCall = {
  input: string;
  init: RequestInit;
};

type FetchHandler = (input: string, init: RequestInit) => Response | Promise<Response>;

function makeFetcher(handler: FetchHandler): { fetcher: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const normalizedInit = init ?? {};
    calls.push({ input: String(input), init: normalizedInit });
    return handler(String(input), normalizedInit);
  }) as typeof fetch;
  return { fetcher, calls };
}

function callbackRequest(query = '?code=code-1&state=state-1', init: RequestInit = {}): Request {
  return new Request(`${PUBLIC_ORIGIN}/api/portal/auth/oauth/github/callback${query}`, {
    method: 'GET',
    ...init,
  });
}

function getHeader(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name);
}

function redirectResponse(location: string, cookies: string[] = []): Response {
  const response = new Response(null, { status: 302, headers: { location } });
  for (const cookie of cookies) {
    response.headers.append('set-cookie', cookie);
  }
  return response;
}

describe('forwardOAuthCallback', () => {
  it('forwards callback query, OAuth cookies, and manual redirect settings', async () => {
    const upstream = redirectResponse(
      `${BASE_URL}/auth/oauth/callback?code=complete&state=next#access_token=fragment-token`,
      [
        'oauth_pending=abc; Path=/api/v1/auth/oauth; Domain=internal.example.test; HttpOnly',
        'email_oauth_nonce=nonce; Path=/api/v1/auth/oauth; Secure',
      ],
    );
    const { fetcher, calls } = makeFetcher(() => upstream);
    const response = await forwardOAuthCallback(
      callbackRequest('?code=code%2B1&state=state%2F1'),
      'github',
      { baseUrl: BASE_URL, publicOrigin: PUBLIC_ORIGIN, fetcher },
    );

    expect(response.status).toBe(303);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(
      `${BASE_URL}/api/v1/auth/oauth/github/callback?code=code%2B1&state=state%2F1`,
    );
    expect(calls[0]?.init.method).toBe('GET');
    expect(calls[0]?.init.redirect).toBe('manual');
    expect(calls[0]?.init.cache).toBe('no-store');
    expect(getHeader(calls[0]!.init, 'referer')).toBe(`${PUBLIC_ORIGIN}/`);
    expect(getHeader(calls[0]!.init, 'x-forwarded-proto')).toBe('https');
    expect(getHeader(calls[0]!.init, 'cookie')).toBeNull();
    expect(response.headers.get('location')).toBe(
      `${PUBLIC_ORIGIN}/auth/oauth/callback?code=complete&state=next#access_token=fragment-token`,
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');

    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain('Path=/api/portal/auth/oauth');
    expect(cookies[1]).toContain('Path=/api/portal/auth/oauth');
    expect(cookies.join(';')).not.toMatch(/Domain=/iu);
  });

  it('forwards only OAuth cookies and drops ordinary session cookies', async () => {
    const { fetcher, calls } = makeFetcher(() =>
      redirectResponse(`${PUBLIC_ORIGIN}/auth/oauth/callback?state=ok`),
    );
    const response = await forwardOAuthCallback(
      callbackRequest('?code=1&state=2', {
        headers: {
          cookie:
            'oauth_pending=one; session=secret; email_oauth_nonce=two; linuxdo_oauth_state=three; ignored=value',
        },
      }),
      'linuxdo',
      { baseUrl: BASE_URL, publicOrigin: PUBLIC_ORIGIN, fetcher },
    );

    expect(response.status).toBe(303);
    expect(getHeader(calls[0]!.init, 'cookie')).toBe(
      'oauth_pending=one; email_oauth_nonce=two; linuxdo_oauth_state=three',
    );
    expect(getHeader(calls[0]!.init, 'authorization')).toBeNull();
  });

  it.each(['admin', 'inference', 'noauth', 'unknown'])(
    'rejects a non-OAuth provider: %s',
    async (provider) => {
      const { fetcher, calls } = makeFetcher(() =>
        redirectResponse(`${PUBLIC_ORIGIN}/auth/oauth/callback`),
      );
      const response = await forwardOAuthCallback(callbackRequest(), provider, {
        baseUrl: BASE_URL,
        publicOrigin: PUBLIC_ORIGIN,
        fetcher,
      });

      expect(response.status).toBe(404);
      expect(calls).toHaveLength(0);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    },
  );

  it('rejects methods other than GET before contacting the backend', async () => {
    const { fetcher, calls } = makeFetcher(() =>
      redirectResponse(`${PUBLIC_ORIGIN}/auth/oauth/callback`),
    );
    const response = await forwardOAuthCallback(
      callbackRequest('', { method: 'POST', body: '{}' }),
      'github',
      { baseUrl: BASE_URL, publicOrigin: PUBLIC_ORIGIN, fetcher },
    );

    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it.each([
    `${BASE_URL}/auth/admin/callback`,
    `${BASE_URL}/auth/inference/callback`,
    `${BASE_URL}/auth/oauth/github/callback`,
    `${BASE_URL}/admin`,
    `${PUBLIC_ORIGIN}/console`,
    'javascript:alert(1)',
    'https://evil.example/auth/oauth/callback?code=steal',
  ])('rejects an unsafe redirect destination: %s', async (location) => {
    const { fetcher, calls } = makeFetcher(() => redirectResponse(location));
    const response = await forwardOAuthCallback(callbackRequest(), 'github', {
      baseUrl: BASE_URL,
      publicOrigin: PUBLIC_ORIGIN,
      fetcher,
    });

    expect(response.status).toBe(502);
    expect(calls).toHaveLength(1);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('accepts a callback redirect from the public origin and preserves fragment tokens', async () => {
    const { fetcher } = makeFetcher(() =>
      redirectResponse(`${PUBLIC_ORIGIN}/auth/oauth/callback?state=done#access_token=abc.def`),
    );
    const response = await forwardOAuthCallback(callbackRequest(), 'google', {
      baseUrl: BASE_URL,
      publicOrigin: PUBLIC_ORIGIN,
      fetcher,
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      `${PUBLIC_ORIGIN}/auth/oauth/callback?state=done#access_token=abc.def`,
    );
  });

  it.each([
    { baseUrl: 'https://internal.example.test/api', publicOrigin: PUBLIC_ORIGIN },
    { baseUrl: BASE_URL, publicOrigin: 'https://portal.example.test/console' },
    { baseUrl: 'javascript:alert(1)', publicOrigin: PUBLIC_ORIGIN },
  ])('returns 503 for invalid callback origins: %o', async ({ baseUrl, publicOrigin }) => {
    const { fetcher, calls } = makeFetcher(() =>
      redirectResponse(`${PUBLIC_ORIGIN}/auth/oauth/callback`),
    );
    const response = await forwardOAuthCallback(callbackRequest(), 'github', {
      baseUrl,
      publicOrigin,
      fetcher,
    });

    expect(response.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it('returns a safe 502 when the backend does not return a redirect', async () => {
    const { fetcher, calls } = makeFetcher(() => new Response('{}', { status: 200 }));
    const response = await forwardOAuthCallback(callbackRequest(), 'github', {
      baseUrl: BASE_URL,
      publicOrigin: PUBLIC_ORIGIN,
      fetcher,
    });

    expect(response.status).toBe(502);
    expect(calls).toHaveLength(1);
    expect(await response.text()).toContain('第三方登录未完成');
  });
});
