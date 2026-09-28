import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  allowedDevelopmentHosts,
  developmentOrigins,
  portalRequestOrigin,
} from '../config/development-origins.mjs';
import { POST } from '../src/app/api/portal/[...path]/route';
import { GET as oauthCallback } from '../src/app/api/portal/auth/oauth/[provider]/callback/route';

const TUNNEL = 'https://portal-dev.example.test';
const LOCAL = 'http://127.0.0.1:3000';
const ENV = { NODE_ENV: 'development', PORTAL_PUBLIC_URL: LOCAL, PORTAL_DEV_ORIGINS: TUNNEL };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function request(origin?: string, forwardedHost?: string) {
  const headers = new Headers();
  if (origin) headers.set('origin', origin);
  if (forwardedHost) {
    headers.set('x-forwarded-host', forwardedHost);
    headers.set('x-forwarded-proto', 'https');
  }
  return new Request(`${LOCAL}/api/portal/auth/login`, { headers });
}

describe('development origins', () => {
  it('uses the public URL and optional tunnel URLs for Next hostnames and API origins', () => {
    const env = {
      ...ENV,
      PORTAL_PUBLIC_URL: `${TUNNEL}/`,
      PORTAL_DEV_ORIGINS: ` ${TUNNEL},https://other.example.test:8443`,
    };
    expect(developmentOrigins(env)).toEqual([
      LOCAL,
      'http://localhost:3000',
      TUNNEL,
      'https://other.example.test:8443',
    ]);
    expect(allowedDevelopmentHosts(env)).toEqual([
      '127.0.0.1',
      'localhost',
      'portal-dev.example.test',
      'other.example.test',
    ]);
  });

  it('does not turn invalid settings, credentials, paths or wildcards into trusted origins', () => {
    expect(
      developmentOrigins({
        PORTAL_DEV_ORIGINS:
          '*,https://*.example.test,https://user:pass@example.test,https://example.test/path,ftp://example.test',
      }),
    ).toEqual([LOCAL, 'http://localhost:3000']);
  });

  it('accepts the configured tunnel while keeping local browser writes available', () => {
    expect(portalRequestOrigin(request(TUNNEL), ENV)).toBe(TUNNEL);
    expect(portalRequestOrigin(request(LOCAL), { ...ENV, PORTAL_PUBLIC_URL: TUNNEL })).toBe(LOCAL);
    expect(portalRequestOrigin(request('http://localhost:3000'), ENV)).toBe(
      'http://localhost:3000',
    );
  });

  it('does not trust a new port, a sibling hostname or spoofed proxy headers', () => {
    expect(portalRequestOrigin(request('https://portal-dev.example.test:444'), ENV)).toBe(LOCAL);
    expect(portalRequestOrigin(request('https://portal-dev.example.test.evil.test'), ENV)).toBe(
      LOCAL,
    );
    expect(portalRequestOrigin(request(undefined, 'attacker.example.test'), ENV)).toBe(LOCAL);
    expect(
      portalRequestOrigin(request('https://attacker.example.test', 'portal-dev.example.test'), ENV),
    ).toBe(LOCAL);
  });

  it('resolves a callback without Origin from an explicitly allowed forwarded host', () => {
    expect(portalRequestOrigin(request(undefined, 'portal-dev.example.test'), ENV)).toBe(TUNNEL);
    expect(
      portalRequestOrigin(request(undefined, 'portal-dev.example.test,attacker.example.test'), ENV),
    ).toBe(LOCAL);
  });

  it('keeps the fixed public origin in production even with development settings present', () => {
    expect(
      portalRequestOrigin(request(TUNNEL, 'portal-dev.example.test'), {
        ...ENV,
        NODE_ENV: 'production',
      }),
    ).toBe(LOCAL);
  });
});

describe('tunnel route integration', () => {
  function setup(mode = 'development') {
    vi.stubEnv('NODE_ENV', mode);
    vi.stubEnv('PORTAL_PUBLIC_URL', LOCAL);
    vi.stubEnv('PORTAL_DEV_ORIGINS', TUNNEL);
    vi.stubEnv('SUB2API_INTERNAL_URL', 'http://backend.example.test');
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ code: 0, data: {} }));
    vi.stubGlobal('fetch', fetcher);
    return fetcher;
  }

  it('forwards a tunnel login with the browser-facing referer and HTTPS scheme', async () => {
    const fetcher = setup();
    const response = await POST(
      new Request(`${LOCAL}/api/portal/auth/login`, {
        method: 'POST',
        headers: { origin: TUNNEL, 'content-type': 'application/json' },
        body: '{}',
      }),
      { params: Promise.resolve({ path: ['auth', 'login'] }) },
    );
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
    const [, init] = fetcher.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get('referer')).toBe(`${TUNNEL}/`);
    expect(headers.get('x-forwarded-proto')).toBe('https');
  });

  it.each(['development', 'production'])(
    'rejects an unknown origin in %s before contacting the backend',
    async (mode) => {
      const fetcher = setup(mode);
      const response = await POST(
        new Request(`${LOCAL}/api/portal/auth/login`, {
          method: 'POST',
          headers: { origin: 'https://attacker.example.test', 'content-type': 'application/json' },
          body: '{}',
        }),
        { params: Promise.resolve({ path: ['auth', 'login'] }) },
      );
      expect(response.status).toBe(403);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it('does not enable tunnel write exceptions in production', async () => {
    const fetcher = setup('production');
    const response = await POST(
      new Request(`${LOCAL}/api/portal/auth/login`, {
        method: 'POST',
        headers: { origin: TUNNEL, 'content-type': 'application/json' },
        body: '{}',
      }),
      { params: Promise.resolve({ path: ['auth', 'login'] }) },
    );
    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps OAuth callback redirects on the allowed tunnel host', async () => {
    setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: '/auth/oauth/callback?state=ok' },
          }),
      ),
    );
    const response = await oauthCallback(
      new Request(`${LOCAL}/api/portal/auth/oauth/github/callback`, {
        headers: { host: 'portal-dev.example.test', 'x-forwarded-proto': 'https' },
      }),
      { params: Promise.resolve({ provider: 'github' }) },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${TUNNEL}/auth/oauth/callback?state=ok`);
  });
});
