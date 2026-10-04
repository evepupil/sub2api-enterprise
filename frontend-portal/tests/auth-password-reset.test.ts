import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { newPasswordErrors, readResetLink, resetEmailError } from '@/lib/auth/password-reset';
import type { BackendCall } from '@/lib/server/sub2api/client';
import type { BackendResult } from '@/lib/server/sub2api/envelope';
import { authReasonFor } from '@/lib/server/session/reasons';

/** 假的后端：记下调用，按调用给结果 */
const backend = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; body?: unknown; forwarded: Headers }>,
  respond: (() => ({ ok: true, data: null })) as (call: BackendCall) => BackendResult<unknown>,
}));

vi.mock('@/lib/server/sub2api/client', () => ({
  callBackend: async (call: BackendCall) => {
    backend.calls.push({ path: call.path, body: call.body, forwarded: call.forwarded });
    return backend.respond(call);
  },
}));

const forgotRoute = await import('@/app/api/portal/auth/forgot-password/route');
const resetRoute = await import('@/app/api/portal/auth/reset-password/route');

function post(
  path: string,
  body: unknown,
  { origin = 'http://portal.test', language }: { origin?: string; language?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    host: 'portal.test',
    origin,
    'x-forwarded-for': '203.0.113.9',
  };
  if (language) headers['accept-language'] = language;
  return new NextRequest(`http://portal.test${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  backend.calls.length = 0;
  backend.respond = () => ({ ok: true, data: { message: 'ok' } });
});

describe('找回密码的规则', () => {
  it('邮箱：空着、格式不对、太长都不行', () => {
    expect(resetEmailError(' ')).toBe('emailRequired');
    expect(resetEmailError('abc')).toBe('emailInvalid');
    expect(resetEmailError(`${'a'.repeat(250)}@b.test`)).toBe('emailInvalid');
    expect(resetEmailError(' a@b.test ')).toBeNull();
  });

  it('重置链接：邮箱和凭证都要在；后端编码过的加号能还原', () => {
    expect(readResetLink('?email=a%2Bb%40x.test&token=abc123')).toEqual({
      email: 'a+b@x.test',
      token: 'abc123',
    });
    expect(readResetLink('?token=abc')).toBeNull();
    expect(readResetLink('?email=a@x.test')).toBeNull();
    expect(readResetLink('?email=bad&token=abc')).toBeNull();
    expect(readResetLink(`?email=a@x.test&token=${'t'.repeat(513)}`)).toBeNull();
    expect(readResetLink('')).toBeNull();
  });

  it('新密码至少 6 位，确认要一模一样', () => {
    expect(newPasswordErrors('', '')).toEqual({
      password: 'passwordRequired',
      confirm: 'confirmRequired',
    });
    expect(newPasswordErrors('12345', '12345')).toEqual({ password: 'passwordShort' });
    expect(newPasswordErrors('123456', '123457')).toEqual({ confirm: 'confirmMismatch' });
    expect(newPasswordErrors('123456', '123456')).toEqual({});
  });

  it('后端的找回密码错误归成页面认得的原因', () => {
    expect(authReasonFor({ status: 400, reason: 'INVALID_RESET_TOKEN', message: '' })).toBe(
      'INVALID_RESET_TOKEN',
    );
    expect(authReasonFor({ status: 403, reason: 'PASSWORD_RESET_DISABLED', message: '' })).toBe(
      'PASSWORD_RESET_DISABLED',
    );
  });
});

describe('找回密码转发接口', () => {
  it('转给后端，带上用户真实 IP；邮件语言换成页面的语言', async () => {
    const english = await forgotRoute.POST(
      post(
        '/api/portal/auth/forgot-password',
        { email: ' a@b.test ', locale: 'en' },
        { language: 'zh-CN,zh;q=0.9' },
      ),
    );
    expect(english.status).toBe(200);
    expect(await english.json()).toEqual({ ok: true });
    expect(backend.calls[0]?.path).toBe('/auth/forgot-password');
    expect(backend.calls[0]?.body).toEqual({ email: 'a@b.test' });
    expect(backend.calls[0]?.forwarded.get('accept-language')).toBe('en');
    expect(backend.calls[0]?.forwarded.get('x-forwarded-for')).toBe('203.0.113.9');

    await forgotRoute.POST(
      post('/api/portal/auth/forgot-password', { email: 'a@b.test', locale: 'zh' }),
    );
    expect(backend.calls[1]?.forwarded.get('accept-language')).toBe('zh-CN');
  });

  it('邮箱不对或外站提交，不转给后端', async () => {
    expect(
      (await forgotRoute.POST(post('/api/portal/auth/forgot-password', { email: 'abc' }))).status,
    ).toBe(400);
    expect(
      (
        await forgotRoute.POST(
          post(
            '/api/portal/auth/forgot-password',
            { email: 'a@b.test' },
            { origin: 'https://evil.test' },
          ),
        )
      ).status,
    ).toBe(403);
    expect(backend.calls).toEqual([]);
  });

  it('后台没开找回密码、太频繁、后端出错时回归类后的原因', async () => {
    backend.respond = () => ({
      ok: false,
      error: { status: 403, reason: 'PASSWORD_RESET_DISABLED', message: 'disabled' },
    });
    const disabled = await forgotRoute.POST(
      post('/api/portal/auth/forgot-password', { email: 'a@b.test' }),
    );
    expect(disabled.status).toBe(403);
    expect(await disabled.json()).toEqual({
      ok: false,
      error: { reason: 'PASSWORD_RESET_DISABLED', status: 403 },
    });

    backend.respond = () => ({ ok: false, error: { status: 429, reason: '', message: '' } });
    const busy = await forgotRoute.POST(
      post('/api/portal/auth/forgot-password', { email: 'a@b.test' }),
    );
    expect(await busy.json()).toMatchObject({ error: { reason: 'TOO_MANY_REQUESTS' } });

    backend.respond = () => ({ ok: false, error: { status: 500, reason: '', message: '' } });
    const down = await forgotRoute.POST(
      post('/api/portal/auth/forgot-password', { email: 'a@b.test' }),
    );
    expect(down.status).toBe(503);
    expect(await down.json()).toMatchObject({ error: { reason: 'BACKEND_UNAVAILABLE' } });
  });
});

describe('重置密码转发接口', () => {
  const body = { email: 'a@b.test', token: 'tok-1', password: '123456' };

  it('字段名换成后端的写法', async () => {
    const response = await resetRoute.POST(post('/api/portal/auth/reset-password', body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(backend.calls[0]?.path).toBe('/auth/reset-password');
    expect(backend.calls[0]?.body).toEqual({
      email: 'a@b.test',
      token: 'tok-1',
      new_password: '123456',
    });
  });

  it('密码太短、缺凭证、邮箱不对或外站提交，不转给后端', async () => {
    const bad = [
      { ...body, password: '12345' },
      { ...body, token: '' },
      { ...body, email: 'abc' },
      { ...body, password: 'x'.repeat(513) },
    ];
    for (const item of bad) {
      expect((await resetRoute.POST(post('/api/portal/auth/reset-password', item))).status).toBe(
        400,
      );
    }
    expect(
      (
        await resetRoute.POST(
          post('/api/portal/auth/reset-password', body, { origin: 'https://evil.test' }),
        )
      ).status,
    ).toBe(403);
    expect(backend.calls).toEqual([]);
  });

  it('链接无效或过期时回 INVALID_RESET_TOKEN', async () => {
    backend.respond = () => ({
      ok: false,
      error: { status: 400, reason: 'INVALID_RESET_TOKEN', message: 'invalid or expired' },
    });
    const response = await resetRoute.POST(post('/api/portal/auth/reset-password', body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: { reason: 'INVALID_RESET_TOKEN', status: 400 },
    });
  });
});
