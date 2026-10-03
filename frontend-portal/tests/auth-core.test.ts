import { describe, expect, it } from 'vitest';

import {
  ACCESS_COOKIE,
  ACCESS_EXPIRY_MARGIN_SECONDS,
  clearedCookieWrites,
  isSecureRequest,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  sessionCookieWrites,
  tokenPairFrom,
} from '@/lib/server/session/cookies';
import { isSameOriginRequest } from '@/lib/server/session/origin';
import { authReasonFor, browserStatusFor } from '@/lib/server/session/reasons';
import { toSessionUser } from '@/lib/server/session/user';
import { parseEnvelope } from '@/lib/server/sub2api/envelope';
import { forwardedHeaders } from '@/lib/server/sub2api/forward';
import { reasonFromResponse } from '@/lib/session/client';
import { avatarInitial, displayName } from '@/lib/session/display';
import { DEFAULT_AFTER_LOGIN, loginRedirectFor, safeNextPath } from '@/lib/session/guard';

describe('后端响应格式', () => {
  it('成功：code 为 0 时取 data', () => {
    expect(parseEnvelope(200, { code: 0, message: 'success', data: { a: 1 } })).toEqual({
      ok: true,
      data: { a: 1 },
    });
  });

  it('失败：状态码即错误类别，带上后端错误代码', () => {
    expect(
      parseEnvelope(401, {
        code: 401,
        message: 'invalid email or password',
        reason: 'INVALID_CREDENTIALS',
      }),
    ).toEqual({
      ok: false,
      error: { status: 401, reason: 'INVALID_CREDENTIALS', message: 'invalid email or password' },
    });
  });

  it('成功状态码里带非 0 的 code 也算失败', () => {
    const result = parseEnvelope(200, { code: 429, message: 'slow down', reason: 'X' });
    expect(result).toEqual({
      ok: false,
      error: { status: 429, reason: 'X', message: 'slow down' },
    });
  });

  it('看不懂的响应按 502 处理，后端自己的错误状态码保留', () => {
    expect(parseEnvelope(200, undefined)).toMatchObject({ ok: false, error: { status: 502 } });
    expect(parseEnvelope(500, '<html>')).toMatchObject({ ok: false, error: { status: 500 } });
  });
});

describe('登录凭证 cookie', () => {
  it('经反向代理时看 X-Forwarded-Proto 判断是否 https', () => {
    const behindTunnel = new Headers({ 'x-forwarded-proto': 'https' });
    expect(isSecureRequest('http://127.0.0.1:3000/api', behindTunnel)).toBe(true);
    expect(isSecureRequest('http://127.0.0.1:3000/api', new Headers())).toBe(false);
    expect(isSecureRequest('https://example.com/api', new Headers())).toBe(true);
  });

  it('访问凭证 cookie 比凭证早一分钟过期，续期凭证 30 天，都是页面读不到的 cookie', () => {
    const writes = sessionCookieWrites(
      { accessToken: 'a', refreshToken: 'r', expiresIn: 86400 },
      true,
    );
    const access = writes.find((w) => w.name === ACCESS_COOKIE);
    const refresh = writes.find((w) => w.name === REFRESH_COOKIE);
    expect(access?.options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
      maxAge: 86400 - ACCESS_EXPIRY_MARGIN_SECONDS,
    });
    expect(refresh?.options.maxAge).toBe(REFRESH_MAX_AGE_SECONDS);
  });

  it('清 cookie 是同名写空值、有效期 0', () => {
    expect(clearedCookieWrites([ACCESS_COOKIE], false)).toEqual([
      {
        name: ACCESS_COOKIE,
        value: '',
        options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: 0 },
      },
    ]);
  });

  it('从后端登录或续期的 data 里取凭证，缺字段返回 null', () => {
    expect(tokenPairFrom({ access_token: 'a', refresh_token: 'r', expires_in: 600 })).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 600,
    });
    expect(tokenPairFrom({ access_token: 'a' })).toBeNull();
    expect(tokenPairFrom(null)).toBeNull();
    // 没给有效期时按后端默认的 24 小时
    expect(tokenPairFrom({ access_token: 'a', refresh_token: 'r' })?.expiresIn).toBe(86400);
  });
});

describe('防跨站提交', () => {
  it('没有 Origin 头放行，同站放行，外站拒绝', () => {
    expect(isSameOriginRequest(new Headers({ host: 'portal.test' }))).toBe(true);
    expect(
      isSameOriginRequest(new Headers({ host: 'portal.test', origin: 'https://portal.test' })),
    ).toBe(true);
    expect(
      isSameOriginRequest(new Headers({ host: 'portal.test', origin: 'https://evil.test' })),
    ).toBe(false);
    expect(isSameOriginRequest(new Headers({ host: 'portal.test', origin: 'null' }))).toBe(false);
  });

  it('经隧道访问时按 X-Forwarded-Host 比对', () => {
    const headers = new Headers({
      host: '127.0.0.1:3000',
      'x-forwarded-host': 'dev.chaosyn.com',
      origin: 'https://dev.chaosyn.com',
    });
    expect(isSameOriginRequest(headers)).toBe(true);
  });
});

describe('错误原因归类', () => {
  it('后端错误代码按表归类，其余按状态码兜底', () => {
    expect(authReasonFor({ status: 401, reason: 'INVALID_CREDENTIALS', message: '' })).toBe(
      'INVALID_CREDENTIALS',
    );
    expect(authReasonFor({ status: 403, reason: 'USER_NOT_ACTIVE', message: '' })).toBe(
      'USER_NOT_ACTIVE',
    );
    expect(authReasonFor({ status: 429, reason: 'TOTP_TOO_MANY_ATTEMPTS', message: '' })).toBe(
      'TOO_MANY_REQUESTS',
    );
    expect(authReasonFor({ status: 429, reason: '', message: '' })).toBe('TOO_MANY_REQUESTS');
    expect(authReasonFor({ status: 503, reason: 'PORTAL_BACKEND_UNAVAILABLE', message: '' })).toBe(
      'BACKEND_UNAVAILABLE',
    );
    expect(authReasonFor({ status: 401, reason: 'PORTAL_NOT_LOGGED_IN', message: '' })).toBe(
      'NOT_LOGGED_IN',
    );
    expect(authReasonFor({ status: 418, reason: 'WHATEVER', message: '' })).toBe('UNKNOWN');
  });

  it('后端 5xx 对浏览器一律给 503', () => {
    expect(browserStatusFor({ status: 500, reason: '', message: '' })).toBe(503);
    expect(browserStatusFor({ status: 401, reason: '', message: '' })).toBe(401);
  });

  it('浏览器端读出官网接口的错误原因，读不出来按状态码兜底', () => {
    expect(
      reasonFromResponse(401, { ok: false, error: { reason: 'INVALID_CREDENTIALS', status: 401 } }),
    ).toBe('INVALID_CREDENTIALS');
    expect(reasonFromResponse(429, null)).toBe('TOO_MANY_REQUESTS');
    expect(reasonFromResponse(0, null)).toBe('BACKEND_UNAVAILABLE');
    expect(reasonFromResponse(400, { error: { reason: 'NOT_A_REASON' } })).toBe('UNKNOWN');
  });
});

describe('当前用户', () => {
  it('只挑界面要用的字段，组织转成驼峰', () => {
    expect(
      toSessionUser({
        id: 7,
        email: 'a@b.test',
        username: 'alice',
        role: 'user',
        balance: 100,
        organization: { id: 3, name: 'Acme', is_owner: true, status: '' },
        created_at: '2026-04-12T09:30:00+08:00',
      }),
    ).toEqual({
      id: 7,
      email: 'a@b.test',
      username: 'alice',
      role: 'user',
      organization: { id: 3, name: 'Acme', isOwner: true },
      createdAt: '2026-04-12T09:30:00+08:00',
    });
  });

  it('个人用户组织为空，字段不全返回 null', () => {
    expect(toSessionUser({ id: 1, email: 'x@y.test' })?.organization).toBeNull();
    expect(
      toSessionUser({ id: 1, email: 'x@y.test', created_at: 'not a date' })?.createdAt,
    ).toBeNull();
    expect(toSessionUser({ email: 'x@y.test' })).toBeNull();
  });

  it('显示名：有用户名用用户名，没有用邮箱前缀；头像取首字', () => {
    const base = {
      id: 1,
      email: 'zhou@example.com',
      role: 'user' as const,
      organization: null,
      createdAt: null,
    };
    expect(displayName({ ...base, username: '' })).toBe('zhou');
    expect(displayName({ ...base, username: ' 林舟 ' })).toBe('林舟');
    expect(avatarInitial('zhou')).toBe('Z');
    expect(avatarInitial('林舟')).toBe('林');
    expect(avatarInitial('')).toBe('');
  });
});

describe('控制台登录拦截与回跳', () => {
  it('没登录跳登录页，回跳地址不带语言前缀', () => {
    expect(loginRedirectFor('/console/keys', '?page=2')).toBe(
      `/login?next=${encodeURIComponent('/console/keys?page=2')}`,
    );
    expect(loginRedirectFor('/en/console/keys', '')).toBe(
      `/en/login?next=${encodeURIComponent('/console/keys')}`,
    );
  });

  it('登录后只回控制台里的站内地址，其余回默认页', () => {
    expect(safeNextPath('/console/keys?page=2')).toBe('/console/keys?page=2');
    expect(safeNextPath('/en/console/keys')).toBe('/console/keys');
    expect(safeNextPath(null)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath('https://evil.test/console')).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath('//evil.test/console')).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath('/\\evil.test')).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath('/pricing')).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath('/consolex')).toBe(DEFAULT_AFTER_LOGIN);
  });
});

describe('转给后端的请求来源信息', () => {
  it('带上真实 IP、浏览器标识与语言，不带 cookie 和其他头', () => {
    const incoming = new Headers({
      'x-forwarded-for': '203.0.113.9, 10.0.0.2',
      'user-agent': 'Mozilla/5.0',
      'accept-language': 'zh-CN',
      cookie: 'portal_at=secret',
      authorization: 'Bearer leaked',
    });
    const out = forwardedHeaders(incoming);
    expect(out.get('x-forwarded-for')).toBe('203.0.113.9, 10.0.0.2');
    expect(out.get('user-agent')).toBe('Mozilla/5.0');
    expect(out.get('accept-language')).toBe('zh-CN');
    expect(out.get('cookie')).toBeNull();
    expect(out.get('authorization')).toBeNull();
  });
});
