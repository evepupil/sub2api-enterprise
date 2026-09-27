import { describe, expect, it } from 'vitest';
import { forwardPortalRequest } from '../src/lib/api/portal-proxy';

const BASE_URL = 'https://internal.example.test';
const PORTAL_URL = 'https://portal.example.test';

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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function identityResponse(organization: unknown, status = 200): Response {
  return jsonResponse(
    {
      code: 0,
      data: {
        id: 9,
        email: 'payer@example.com',
        username: 'payer',
        organization,
      },
    },
    status,
  );
}

function paymentRequest(path = '/payment/config'): Request {
  return new Request(`${PORTAL_URL}/api/portal${path}`, {
    method: 'GET',
    headers: { authorization: 'Bearer current-token' },
  });
}

describe('portal payment permission gate', () => {
  it.each([
    ['individual account', null],
    ['organization owner', { id: 2, name: 'Owner Organization', is_owner: true }],
  ])('allows payment access for %s after identity verification', async (_label, organization) => {
    const { fetcher, calls } = makeFetcher((input, init) => {
      if (input.endsWith('/auth/me')) {
        expect(init.method).toBe('GET');
        expect(new Headers(init.headers).get('authorization')).toBe('Bearer current-token');
        return identityResponse(organization);
      }
      if (input.endsWith('/payment/config')) {
        return jsonResponse({ code: 0, data: { enabled: true } });
      }
      throw new Error(`unexpected URL: ${input}`);
    });

    const response = await forwardPortalRequest(paymentRequest(), ['payment', 'config'], {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(response.status).toBe(200);
    expect(calls.map((call) => call.input)).toEqual([
      `${BASE_URL}/api/v1/auth/me`,
      `${BASE_URL}/api/v1/payment/config`,
    ]);
  });

  it('blocks organization members before calling the payment endpoint', async () => {
    let paymentCalls = 0;
    const { fetcher, calls } = makeFetcher((input) => {
      if (input.endsWith('/auth/me')) {
        return identityResponse({ id: 3, name: 'Member Organization', is_owner: false });
      }
      if (input.endsWith('/payment/config')) {
        paymentCalls += 1;
        return jsonResponse({ code: 0, data: { enabled: true } });
      }
      throw new Error(`unexpected URL: ${input}`);
    });

    const response = await forwardPortalRequest(paymentRequest(), ['payment', 'config'], {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toContain('组织成员');
    expect(paymentCalls).toBe(0);
    expect(calls.map((call) => call.input)).toEqual([`${BASE_URL}/api/v1/auth/me`]);
  });

  it('returns identity 401 without calling payment so the client can renew the session', async () => {
    const { fetcher, calls } = makeFetcher((input) => {
      if (input.endsWith('/auth/me')) {
        return new Response(JSON.stringify({ code: 401, reason: 'TOKEN_EXPIRED' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`payment endpoint must not be called: ${input}`);
    });

    const response = await forwardPortalRequest(paymentRequest(), ['payment', 'config'], {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(response.status).toBe(401);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(`${BASE_URL}/api/v1/auth/me`);
  });

  it.each([
    ['identity upstream failure', () => new Response('{}', { status: 500 }), 503],
    ['identity invalid envelope', () => jsonResponse({ code: 0, data: {} }), 502],
    ['identity invalid JSON', () => new Response('not json', { status: 200 }), 502],
  ])('does not call payment when identity is invalid: %s', async (_label, makeIdentity, status) => {
    let paymentCalls = 0;
    const { fetcher, calls } = makeFetcher((input) => {
      if (input.endsWith('/auth/me')) {
        return makeIdentity();
      }
      if (input.endsWith('/payment/config')) {
        paymentCalls += 1;
        return jsonResponse({ code: 0, data: { shouldNotReach: true } });
      }
      throw new Error(`unexpected URL: ${input}`);
    });

    const response = await forwardPortalRequest(paymentRequest(), ['payment', 'config'], {
      baseUrl: BASE_URL,
      fetcher,
    });

    expect(response.status).toBe(status);
    expect(paymentCalls).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it('does not add an identity preflight to non-payment routes', async () => {
    const { fetcher, calls } = makeFetcher((input) => {
      if (input.endsWith('/auth/me')) {
        return identityResponse({ id: 3, name: 'Member Organization', is_owner: false });
      }
      throw new Error(`unexpected URL: ${input}`);
    });

    const response = await forwardPortalRequest(
      new Request(`${PORTAL_URL}/api/portal/auth/me`, {
        headers: { authorization: 'Bearer current-token' },
      }),
      ['auth', 'me'],
      { baseUrl: BASE_URL, fetcher },
    );

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(`${BASE_URL}/api/v1/auth/me`);
  });
});
