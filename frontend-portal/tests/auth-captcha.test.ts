import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fromPortalSettings, toAuthSettings } from '@/lib/auth/settings';
import { turnstileLanguage } from '@/lib/auth/turnstile';
import { CAPTCHA_TOKEN_MAX, captchaTokenFrom, withCaptcha } from '@/lib/server/session/captcha';
import { authReasonFor } from '@/lib/server/session/reasons';
import type { BackendCall } from '@/lib/server/sub2api/client';
import type { BackendResult } from '@/lib/server/sub2api/envelope';

/** 假的后端：记下调用，按路径给结果 */
const backend = vi.hoisted(() => ({
  calls: [] as Array<{ path: string; body?: unknown }>,
  respond: (() => ({ ok: true, data: null })) as (call: BackendCall) => BackendResult<unknown>,
}));

vi.mock('@/lib/server/sub2api/client', () => ({
  callBackend: async (call: BackendCall) => {
    backend.calls.push({ path: call.path, body: call.body });
    return backend.respond(call);
  },
}));

const loginRoute = await import('@/app/api/portal/auth/login/route');
const registerRoute = await import('@/app/api/portal/auth/register/route');
const sendCodeRoute = await import('@/app/api/portal/auth/send-verify-code/route');
const forgotRoute = await import('@/app/api/portal/auth/forgot-password/route');

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://portal.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'portal.test',
      origin: 'http://portal.test',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  backend.calls.length = 0;
  backend.respond = () => ({ ok: true, data: null });
});

describe('人机验证结果', () => {
  it('没带是空串，类型不对或超长按请求有误', () => {
    expect(captchaTokenFrom({})).toBe('');
    expect(captchaTokenFrom({ captchaToken: '' })).toBe('');
    expect(captchaTokenFrom({ captchaToken: 'tok' })).toBe('tok');
    expect(captchaTokenFrom({ captchaToken: 42 })).toBeNull();
    expect(captchaTokenFrom({ captchaToken: 'x'.repeat(CAPTCHA_TOKEN_MAX + 1) })).toBeNull();
  });

  it('有结果时按后台字段名 turnstile_token 带上，没有就不带', () => {
    expect(withCaptcha({ email: 'a@b.test' }, 'tok')).toEqual({
      email: 'a@b.test',
      turnstile_token: 'tok',
    });
    expect(withCaptcha({ email: 'a@b.test' }, '')).toEqual({ email: 'a@b.test' });
  });

  it('验证框的语言跟着页面', () => {
    expect(turnstileLanguage('zh')).toBe('zh-cn');
    expect(turnstileLanguage('en')).toBe('en');
  });
});

describe('后台的人机验证开关', () => {
  it('开了 Cloudflare 且有站点公钥才显示验证框；腾讯、阿里的验证码官网不支持', () => {
    expect(
      toAuthSettings({ turnstile_enabled: true, turnstile_site_key: ' 1x00AA ' }).turnstileSiteKey,
    ).toBe('1x00AA');
    expect(toAuthSettings({ turnstile_enabled: true }).turnstileSiteKey).toBe('');
    expect(
      toAuthSettings({ turnstile_enabled: false, turnstile_site_key: '1x00AA' }).turnstileSiteKey,
    ).toBe('');
    expect(toAuthSettings({ tencent_captcha_enabled: true }).turnstileSiteKey).toBe('');
  });

  it('官网接口给浏览器的开关里，站点公钥只认字符串', () => {
    expect(fromPortalSettings({ turnstileSiteKey: '1x00AA' }).turnstileSiteKey).toBe('1x00AA');
    expect(fromPortalSettings({ turnstileSiteKey: true }).turnstileSiteKey).toBe('');
  });

  it('没通过可以重新验证；后台配置有问题或用了别家验证码时提示验证不可用', () => {
    const reason = (code: string, status = 400) =>
      authReasonFor({ status, reason: code, message: '' });
    expect(reason('TURNSTILE_VERIFICATION_FAILED')).toBe('CAPTCHA_FAILED');
    expect(reason('TURNSTILE_NOT_CONFIGURED', 503)).toBe('CAPTCHA_UNAVAILABLE');
    expect(reason('TURNSTILE_INVALID_SECRET_KEY')).toBe('CAPTCHA_UNAVAILABLE');
    expect(reason('TENCENT_CAPTCHA_VERIFICATION_FAILED')).toBe('CAPTCHA_UNAVAILABLE');
    expect(reason('CAPTCHA_PROVIDER_CONFLICT')).toBe('CAPTCHA_UNAVAILABLE');
  });
});

describe('四个要验证的转发接口', () => {
  it('登录、注册、发验证码、找回密码都把验证结果转给后台', async () => {
    backend.respond = () => ({
      ok: false,
      error: { status: 400, reason: 'TURNSTILE_VERIFICATION_FAILED', message: '' },
    });
    const cases = [
      () =>
        loginRoute.POST(
          post('/api/portal/auth/login', { email: 'a@b.test', password: 'p', captchaToken: 't1' }),
        ),
      () =>
        registerRoute.POST(
          post('/api/portal/auth/register', {
            email: 'a@b.test',
            password: '123456',
            captchaToken: 't2',
          }),
        ),
      () =>
        sendCodeRoute.POST(
          post('/api/portal/auth/send-verify-code', { email: 'a@b.test', captchaToken: 't3' }),
        ),
      () =>
        forgotRoute.POST(
          post('/api/portal/auth/forgot-password', { email: 'a@b.test', captchaToken: 't4' }),
        ),
    ];
    for (const send of cases) {
      const response = await send();
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { reason: 'CAPTCHA_FAILED' } });
    }
    expect(backend.calls.map((call) => call.path)).toEqual([
      '/auth/login',
      '/auth/register',
      '/auth/send-verify-code',
      '/auth/forgot-password',
    ]);
    expect(
      backend.calls.map((call) => (call.body as Record<string, unknown>).turnstile_token),
    ).toEqual(['t1', 't2', 't3', 't4']);
  });

  it('验证结果超长或类型不对，不转给后台', async () => {
    const long = 'x'.repeat(CAPTCHA_TOKEN_MAX + 1);
    const responses = await Promise.all([
      loginRoute.POST(
        post('/api/portal/auth/login', { email: 'a@b.test', password: 'p', captchaToken: long }),
      ),
      registerRoute.POST(
        post('/api/portal/auth/register', {
          email: 'a@b.test',
          password: '123456',
          captchaToken: 1,
        }),
      ),
      sendCodeRoute.POST(
        post('/api/portal/auth/send-verify-code', { email: 'a@b.test', captchaToken: long }),
      ),
      forgotRoute.POST(
        post('/api/portal/auth/forgot-password', { email: 'a@b.test', captchaToken: [] }),
      ),
    ]);
    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400]);
    expect(backend.calls).toEqual([]);
  });
});
