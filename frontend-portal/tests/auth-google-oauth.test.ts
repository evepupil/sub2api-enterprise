import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  afterLoginPath,
  authorizeUrlFrom,
  backendStartQuery,
  callbackOutcome,
  completeBackendBody,
  completePath,
  cookieJar,
  decodeOAuthCookie,
  encodeOAuthCookie,
  failureFor,
  loginErrorPath,
  oauthErrorFor,
  parseCompleteInput,
  parseStartParams,
  pendingInfoFrom,
} from '@/lib/server/oauth/google';
import type { RelayCall, RelayResponse } from '@/lib/server/sub2api/relay';
import { parseSetCookie } from '@/lib/server/sub2api/relay';

/** 假的后台：记下每次转发，按路径给结果 */
const backend = vi.hoisted(() => ({
  calls: [] as RelayCall[],
  respond: (() => null) as (call: RelayCall) => RelayResponse | null,
}));

vi.mock('@/lib/server/sub2api/relay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/sub2api/relay')>();
  return {
    ...actual,
    relayBackend: async (call: RelayCall) => {
      backend.calls.push(call);
      return backend.respond(call);
    },
  };
});

const startRoute = await import('@/app/api/portal/auth/oauth/google/start/route');
const callbackRoute = await import('@/app/api/portal/auth/oauth/google/callback/route');
const pendingRoute = await import('@/app/api/portal/auth/oauth/google/pending/route');
const completeRoute = await import('@/app/api/portal/auth/oauth/google/complete/route');

const ORIGIN = 'http://portal.test';
const GOOGLE = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=s1';

function request(
  path: string,
  init: { method?: string; body?: unknown; cookie?: string; origin?: string } = {},
): NextRequest {
  const headers: Record<string, string> = { host: 'portal.test' };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.origin !== undefined) headers.origin = init.origin;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  return new NextRequest(`${ORIGIN}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const relayed = (patch: Partial<RelayResponse>): RelayResponse => ({
  status: 200,
  location: null,
  setCookies: [],
  body: undefined,
  ...patch,
});

const cookieOf = (response: Response, name: string) =>
  response.headers.getSetCookie().find((line) => line.startsWith(`${name}=`)) ?? null;

const STATE_PAYLOAD = encodeOAuthCookie({
  cookies: { email_oauth_state: 'c3RhdGU', email_oauth_provider: 'Z29vZ2xl' },
  next: '/console/keys',
  locale: 'zh',
});
const PENDING_PAYLOAD = encodeOAuthCookie({
  cookies: { oauth_pending_session: 'cGVuZA', oauth_pending_browser_session: 'YnJv' },
  next: '/console/usage',
  locale: 'zh',
});

beforeEach(() => {
  backend.calls = [];
  backend.respond = () => null;
});

describe('谷歌登录的规则', () => {
  it('发起参数：语言、回跳只认控制台地址、各项去空格限长', () => {
    const params = parseStartParams(
      new URLSearchParams(
        'locale=en&next=%2Fen%2Fconsole%2Fkeys&invitation_code=%20ABC%20&organization_name=' +
          'a'.repeat(101),
      ),
    );
    expect(params).toMatchObject({ locale: 'en', next: '/console/keys', invitationCode: 'ABC' });
    expect(params.organizationName).toBeUndefined();
    expect(parseStartParams(new URLSearchParams('next=https://evil.test')).next).toBe(
      '/console/usage',
    );
    expect(backendStartQuery({ locale: 'zh', next: '/console/usage', affCode: 'AFF' })).toBe(
      'redirect=%2Fconsole&aff_code=AFF',
    );
  });

  it('谷歌授权地址只认 http(s) 完整地址', () => {
    expect(authorizeUrlFrom(GOOGLE)).toBe(GOOGLE);
    expect(authorizeUrlFrom('javascript:alert(1)')).toBeNull();
    expect(authorizeUrlFrom('/relative')).toBeNull();
    expect(authorizeUrlFrom(null)).toBeNull();
  });

  it('后台设的 cookie：去掉正在清除的、不安全的，可只取指定几个', () => {
    expect(parseSetCookie('a=1; Path=/api/v1/auth/oauth; Max-Age=600; HttpOnly')).toEqual({
      name: 'a',
      value: '1',
      cleared: false,
    });
    expect(parseSetCookie('a=; Path=/; Max-Age=-1')?.cleared).toBe(true);
    expect(parseSetCookie('a=1; Expires=Thu, 01 Jan 1970 00:00:00 GMT')?.cleared).toBe(true);
    const jar = cookieJar([
      { name: 'oauth_pending_session', value: 'cGVuZA', cleared: false },
      { name: 'email_oauth_state', value: '', cleared: true },
      { name: 'bad', value: 'x;y', cleared: false },
      { name: 'other', value: 'b', cleared: false },
    ]);
    expect(jar).toEqual({ oauth_pending_session: 'cGVuZA', other: 'b' });
    expect(
      cookieJar([{ name: 'other', value: 'b', cleared: false }], ['oauth_pending_session']),
    ).toEqual({});
  });

  it('官网临时 cookie 存取一致；看不懂的按过期处理，回跳地址再查一遍', () => {
    expect(decodeOAuthCookie(STATE_PAYLOAD)).toEqual({
      cookies: { email_oauth_state: 'c3RhdGU', email_oauth_provider: 'Z29vZ2xl' },
      next: '/console/keys',
      locale: 'zh',
    });
    expect(decodeOAuthCookie('not-json')).toBeNull();
    expect(decodeOAuthCookie(undefined)).toBeNull();
    const tampered = Buffer.from(
      JSON.stringify({ c: { 'a;b': 'x', ok: 'y' }, n: '//evil.test', l: 'fr' }),
    ).toString('base64url');
    expect(decodeOAuthCookie(tampered)).toEqual({
      cookies: { ok: 'y' },
      next: '/console/usage',
      locale: 'zh',
    });
  });

  it('后台回调跳转地址里的结果：令牌、错误、或待完成注册', () => {
    const signedIn = callbackOutcome(
      '/auth/oauth/callback#access_token=at1&expires_in=3600&redirect=%252Fconsole&refresh_token=rt_1&token_type=Bearer',
    );
    expect(signedIn).toEqual({
      kind: 'signed_in',
      pair: { accessToken: 'at1', refreshToken: 'rt_1', expiresIn: 3600 },
    });
    expect(callbackOutcome('/auth/oauth/callback')).toEqual({ kind: 'pending' });
    expect(
      callbackOutcome('/cb#error=provider_error&error_message=access_denied&error_description=x'),
    ).toEqual({ kind: 'error', error: 'cancelled' });
    expect(callbackOutcome('/cb#error=invalid_state&error_message=invalid+oauth+state')).toEqual({
      kind: 'error',
      error: 'expired',
    });
    expect(callbackOutcome('/cb#error=&error_message=internal+error')).toEqual({
      kind: 'error',
      error: 'failed',
    });
    expect(callbackOutcome(null)).toEqual({ kind: 'error', error: 'failed' });
  });

  it('后台的错误代码对应登录页的提示', () => {
    expect(oauthErrorFor('USER_NOT_ACTIVE')).toBe('inactive');
    expect(oauthErrorFor('EMAIL_SUFFIX_NOT_ALLOWED')).toBe('suffix');
    expect(oauthErrorFor('AUTH_IDENTITY_EMAIL_MISMATCH')).toBe('conflict');
    expect(oauthErrorFor('login_blocked')).toBe('admin_only');
    expect(oauthErrorFor('TENCENT_CAPTCHA_VERIFICATION_FAILED')).toBe('captcha');
    expect(failureFor(404, { code: 404, reason: 'OAUTH_DISABLED' })).toBe('disabled');
    expect(failureFor(429, { error: 'rate limit exceeded' })).toBe('too_many');
    expect(failureFor(500, undefined)).toBe('failed');
  });

  it('去哪：语言前缀', () => {
    expect(loginErrorPath('en', 'expired')).toBe('/en/login?oauth_error=expired');
    expect(completePath('zh')).toBe('/register/google');
    expect(afterLoginPath('en', '/console/keys')).toBe('/en/console/keys');
  });

  it('完成注册：谷歌邮箱、是否必须填邀请码；提交内容检查与后台字段名', () => {
    expect(
      pendingInfoFrom({ email: 'a@b.c', resolved_email: 'A@b.c', error: 'invitation_required' }),
    ).toEqual({ email: 'A@b.c', invitationRequired: true });
    expect(pendingInfoFrom({ email: 'a@b.c', invitation_required: false })).toEqual({
      email: 'a@b.c',
      invitationRequired: false,
    });
    expect(pendingInfoFrom({})).toBeNull();
    expect(parseCompleteInput({ password: '12345' })).toBeNull();
    expect(
      parseCompleteInput({ password: ' 12345', organizationMemberName: 'x'.repeat(51) }),
    ).toBeNull();
    const input = parseCompleteInput({
      password: ' 12345',
      invitationCode: ' INV ',
      organizationName: '',
      affCode: 'AFF',
    });
    expect(input).toEqual({ password: ' 12345', invitationCode: 'INV', affCode: 'AFF' });
    expect(input && completeBackendBody(input)).toEqual({
      password: ' 12345',
      invitation_code: 'INV',
      aff_code: 'AFF',
    });
  });
});

describe('发起：/api/portal/auth/oauth/google/start', () => {
  it('后台给了谷歌地址：状态 cookie 转存到官网的谷歌登录路径下，浏览器去谷歌', async () => {
    backend.respond = () =>
      relayed({
        status: 302,
        location: GOOGLE,
        setCookies: [
          { name: 'email_oauth_state', value: 'c3RhdGU', cleared: false },
          { name: 'email_oauth_provider', value: 'Z29vZ2xl', cleared: false },
        ],
      });
    const response = await startRoute.GET(
      request('/api/portal/auth/oauth/google/start?locale=zh&next=%2Fconsole%2Fkeys&promo=P1'),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(GOOGLE);
    expect(backend.calls[0]).toMatchObject({
      method: 'GET',
      path: '/auth/oauth/google/start',
      query: 'redirect=%2Fconsole&promo_code=P1',
    });
    const state = cookieOf(response, 'portal_oauth_state');
    expect(state).toMatch(/Path=\/api\/portal\/auth\/oauth/);
    expect(state).toMatch(/HttpOnly/i);
    const value = state?.split(';')[0]?.split('=').slice(1).join('=');
    expect(decodeOAuthCookie(value)).toMatchObject({ next: '/console/keys', locale: 'zh' });
  });

  it('后台没开谷歌登录：回登录页显示原因', async () => {
    backend.respond = () =>
      relayed({ status: 404, body: { code: 404, message: 'x', reason: 'OAUTH_DISABLED' } });
    const response = await startRoute.GET(request('/api/portal/auth/oauth/google/start?locale=en'));
    expect(response.headers.get('location')).toBe(`${ORIGIN}/en/login?oauth_error=disabled`);
  });

  it('连不上后台：回登录页', async () => {
    const response = await startRoute.GET(request('/api/portal/auth/oauth/google/start'));
    expect(response.headers.get('location')).toBe(`${ORIGIN}/login?oauth_error=failed`);
  });
});

describe('回调：/api/portal/auth/oauth/google/callback', () => {
  const path = '/api/portal/auth/oauth/google/callback?code=c1&state=s1';

  it('没有发起时的 cookie：回登录页提示过期，不调后台', async () => {
    const response = await callbackRoute.GET(request(path));
    expect(response.headers.get('location')).toBe(`${ORIGIN}/login?oauth_error=expired`);
    expect(backend.calls).toHaveLength(0);
  });

  it('老用户：带着存下的 cookie 原样转给后台，令牌写进登录 cookie，去发起时的控制台地址', async () => {
    backend.respond = () =>
      relayed({
        status: 302,
        location:
          '/auth/oauth/callback#access_token=at1&expires_in=3600&refresh_token=rt_1&token_type=Bearer',
        setCookies: [{ name: 'email_oauth_state', value: '', cleared: true }],
      });
    const response = await callbackRoute.GET(
      request(path, { cookie: `portal_oauth_state=${STATE_PAYLOAD}` }),
    );
    expect(backend.calls[0]).toMatchObject({
      path: '/auth/oauth/google/callback',
      query: 'code=c1&state=s1',
      cookies: { email_oauth_state: 'c3RhdGU', email_oauth_provider: 'Z29vZ2xl' },
    });
    expect(response.headers.get('location')).toBe(`${ORIGIN}/console/keys`);
    expect(cookieOf(response, 'portal_at')).toMatch(/^portal_at=at1;/);
    expect(cookieOf(response, 'portal_rt')).toMatch(/^portal_rt=rt_1;/);
    expect(cookieOf(response, 'portal_oauth_state')).toMatch(/^portal_oauth_state=;/);
  });

  it('新用户：存下后台的待完成 cookie，去完成注册页', async () => {
    backend.respond = () =>
      relayed({
        status: 302,
        location: '/auth/oauth/callback',
        setCookies: [
          { name: 'oauth_pending_session', value: 'cGVuZA', cleared: false },
          { name: 'oauth_pending_browser_session', value: 'YnJv', cleared: false },
        ],
      });
    const response = await callbackRoute.GET(
      request(path, { cookie: `portal_oauth_state=${STATE_PAYLOAD}` }),
    );
    expect(response.headers.get('location')).toBe(`${ORIGIN}/register/google`);
    const pending = cookieOf(response, 'portal_oauth_pending');
    expect(pending).toMatch(/Path=\/api\/portal\/auth\/oauth/);
    const value = pending?.split(';')[0]?.split('=').slice(1).join('=');
    expect(decodeOAuthCookie(value)?.cookies).toEqual({
      oauth_pending_session: 'cGVuZA',
      oauth_pending_browser_session: 'YnJv',
    });
    expect(cookieOf(response, 'portal_at')).toBeNull();
  });

  it('谷歌那边取消：回登录页（按发起时的语言）', async () => {
    const english = encodeOAuthCookie({
      cookies: { email_oauth_state: 'c3RhdGU' },
      next: '/console/usage',
      locale: 'en',
    });
    backend.respond = () =>
      relayed({
        status: 302,
        location: '/auth/oauth/callback#error=provider_error&error_message=access_denied',
      });
    const response = await callbackRoute.GET(
      request(path, { cookie: `portal_oauth_state=${english}` }),
    );
    expect(response.headers.get('location')).toBe(`${ORIGIN}/en/login?oauth_error=cancelled`);
  });
});

describe('完成注册：pending 与 complete', () => {
  const post = (path: string, body: unknown, cookie?: string, origin = ORIGIN) =>
    request(path, { method: 'POST', body, cookie, origin });

  it('别的网站发起的回 403；没有待完成 cookie 回 410 并清 cookie', async () => {
    expect(
      (
        await pendingRoute.POST(
          post('/api/portal/auth/oauth/google/pending', {}, undefined, 'https://evil.test'),
        )
      ).status,
    ).toBe(403);
    const response = await pendingRoute.POST(post('/api/portal/auth/oauth/google/pending', {}));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      ok: false,
      error: { reason: 'OAUTH_SESSION_EXPIRED', status: 410 },
    });
    expect(backend.calls).toHaveLength(0);
  });

  it('pending：带着待完成 cookie 问后台，回谷歌邮箱与是否要邀请码', async () => {
    backend.respond = () =>
      relayed({
        status: 200,
        body: {
          code: 0,
          message: 'success',
          data: { email: 'new@gmail.com', invitation_required: true, error: 'invitation_required' },
        },
      });
    const response = await pendingRoute.POST(
      post('/api/portal/auth/oauth/google/pending', {}, `portal_oauth_pending=${PENDING_PAYLOAD}`),
    );
    expect(await response.json()).toEqual({
      ok: true,
      email: 'new@gmail.com',
      invitationRequired: true,
    });
    expect(backend.calls[0]).toMatchObject({
      method: 'POST',
      path: '/auth/oauth/pending/exchange',
      cookies: { oauth_pending_session: 'cGVuZA', oauth_pending_browser_session: 'YnJv' },
    });
  });

  it('pending：后台说会话已过期，回 410 并清 cookie', async () => {
    backend.respond = () =>
      relayed({
        status: 401,
        body: { code: 401, message: 'x', reason: 'PENDING_AUTH_SESSION_EXPIRED' },
      });
    const response = await pendingRoute.POST(
      post('/api/portal/auth/oauth/google/pending', {}, `portal_oauth_pending=${PENDING_PAYLOAD}`),
    );
    expect(response.status).toBe(410);
    expect(cookieOf(response, 'portal_oauth_pending')).toMatch(/^portal_oauth_pending=;/);
  });

  it('complete：后台回裸令牌，写登录 cookie、清待完成 cookie', async () => {
    backend.respond = () =>
      relayed({
        status: 200,
        body: {
          access_token: 'at2',
          refresh_token: 'rt_2',
          expires_in: 7200,
          token_type: 'Bearer',
        },
      });
    const response = await completeRoute.POST(
      post(
        '/api/portal/auth/oauth/google/complete',
        { password: 'secret1', organizationName: 'Acme', organizationMemberName: '张三' },
        `portal_oauth_pending=${PENDING_PAYLOAD}`,
      ),
    );
    expect(await response.json()).toEqual({ ok: true, status: 'signed_in' });
    expect(backend.calls[0]).toMatchObject({
      path: '/auth/oauth/google/complete-registration',
      body: { password: 'secret1', organization_name: 'Acme', organization_member_name: '张三' },
    });
    expect(cookieOf(response, 'portal_at')).toMatch(/^portal_at=at2;/);
    expect(cookieOf(response, 'portal_oauth_pending')).toMatch(/^portal_oauth_pending=;/);
  });

  it('complete：注册已关闭等原因照注册页那一套回；密码太短回 400 不调后台', async () => {
    backend.respond = () =>
      relayed({ status: 403, body: { code: 403, message: 'x', reason: 'REGISTRATION_DISABLED' } });
    const closed = await completeRoute.POST(
      post(
        '/api/portal/auth/oauth/google/complete',
        { password: 'secret1' },
        `portal_oauth_pending=${PENDING_PAYLOAD}`,
      ),
    );
    expect(closed.status).toBe(403);
    expect(await closed.json()).toEqual({
      ok: false,
      error: { reason: 'REGISTRATION_DISABLED', status: 403 },
    });
    backend.calls = [];
    const short = await completeRoute.POST(
      post(
        '/api/portal/auth/oauth/google/complete',
        { password: '123' },
        `portal_oauth_pending=${PENDING_PAYLOAD}`,
      ),
    );
    expect(short.status).toBe(400);
    expect(backend.calls).toHaveLength(0);
  });
});
