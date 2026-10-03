import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BackendCall } from '@/lib/server/sub2api/client';
import type { BackendResult } from '@/lib/server/sub2api/envelope';

/** 假的后端：记下调用，按路径给结果 */
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

const registerRoute = await import('@/app/api/portal/auth/register/route');
const inviteRoute = await import('@/app/api/portal/auth/validate-invitation-code/route');
const promoRoute = await import('@/app/api/portal/auth/validate-promo-code/route');
const sendCodeRoute = await import('@/app/api/portal/auth/send-verify-code/route');
const { getAuthSettings, resetAuthSettingsCache, PUBLIC_SETTINGS_TTL_MS } =
  await import('@/lib/server/sub2api/public-settings');

function post(path: string, body: unknown, origin = 'http://portal.test'): NextRequest {
  return new NextRequest(`http://portal.test${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'portal.test',
      origin,
      'x-forwarded-for': '203.0.113.9',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  backend.calls.length = 0;
});

describe('注册转发接口', () => {
  it('字段名换成后端的写法，只带填了的项，并带上用户真实 IP', async () => {
    backend.respond = () => ({
      ok: true,
      data: {
        access_token: 'a1',
        refresh_token: 'r1',
        expires_in: 600,
        user: {
          id: 9,
          email: 'a@b.test',
          role: 'user',
          organization: { id: 3, name: 'Acme', is_owner: true },
        },
      },
    });
    const response = await registerRoute.POST(
      post('/api/portal/auth/register', {
        email: ' a@b.test ',
        password: '123456',
        verifyCode: '654321',
        organizationName: 'Acme',
        organizationMemberName: '林舟',
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      status: 'signed_in',
      user: { organization: { isOwner: true } },
    });
    expect(backend.calls[0]?.path).toBe('/auth/register');
    expect(backend.calls[0]?.body).toEqual({
      email: 'a@b.test',
      password: '123456',
      verify_code: '654321',
      invitation_code: undefined,
      promo_code: undefined,
      aff_code: undefined,
      organization_name: 'Acme',
      organization_member_name: '林舟',
    });
    expect(backend.calls[0]?.forwarded.get('x-forwarded-for')).toBe('203.0.113.9');
    const cookies = response.headers.getSetCookie().join('\n');
    expect(cookies).toContain('portal_at=a1');
    expect(cookies).toContain('portal_rt=r1');
    expect(cookies).toContain('HttpOnly');
  });

  it('后端拒绝时返回归类后的原因，不写 cookie', async () => {
    backend.respond = () => ({
      ok: false,
      error: { status: 409, reason: 'EMAIL_EXISTS', message: 'email already exists' },
    });
    const response = await registerRoute.POST(
      post('/api/portal/auth/register', { email: 'a@b.test', password: '123456' }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: false,
      error: { reason: 'EMAIL_EXISTS', status: 409 },
    });
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('缺邮箱密码、字段超长或外站提交，不转给后端', async () => {
    expect(
      (await registerRoute.POST(post('/api/portal/auth/register', { email: 'a@b.test' }))).status,
    ).toBe(400);
    expect(
      (
        await registerRoute.POST(
          post('/api/portal/auth/register', {
            email: 'a@b.test',
            password: '123456',
            organizationName: 'x'.repeat(101),
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await registerRoute.POST(
          post(
            '/api/portal/auth/register',
            { email: 'a@b.test', password: '1' },
            'https://evil.test',
          ),
        )
      ).status,
    ).toBe(403);
    expect(backend.calls).toEqual([]);
  });
});

describe('邀请码与优惠码预校验、发验证码', () => {
  it('邀请码：带回是否有效、平台还是组织、错误代码', async () => {
    backend.respond = () => ({ ok: true, data: { valid: true, type: 'organization' } });
    expect(
      await (
        await inviteRoute.POST(
          post('/api/portal/auth/validate-invitation-code', { code: ' ORG1 ' }),
        )
      ).json(),
    ).toEqual({
      ok: true,
      valid: true,
      type: 'organization',
      errorCode: '',
    });
    expect(backend.calls[0]?.body).toEqual({ code: 'ORG1' });
    backend.respond = () => ({
      ok: true,
      data: { valid: false, error_code: 'INVITATION_CODE_EXPIRED', type: 'platform' },
    });
    expect(
      await (
        await inviteRoute.POST(post('/api/portal/auth/validate-invitation-code', { code: 'OLD' }))
      ).json(),
    ).toMatchObject({
      valid: false,
      errorCode: 'INVITATION_CODE_EXPIRED',
    });
  });

  it('优惠码：有效时带回赠送余额', async () => {
    backend.respond = () => ({ ok: true, data: { valid: true, bonus_amount: 5 } });
    expect(
      await (
        await promoRoute.POST(post('/api/portal/auth/validate-promo-code', { code: 'P' }))
      ).json(),
    ).toEqual({
      ok: true,
      valid: true,
      bonusAmount: 5,
      errorCode: '',
    });
  });

  it('发验证码：带回倒计时，太频繁时归类原因', async () => {
    backend.respond = () => ({ ok: true, data: { message: 'sent', countdown: 60 } });
    expect(
      await (
        await sendCodeRoute.POST(post('/api/portal/auth/send-verify-code', { email: 'a@b.test' }))
      ).json(),
    ).toEqual({
      ok: true,
      countdown: 60,
    });
    backend.respond = () => ({
      ok: false,
      error: { status: 429, reason: 'VERIFY_CODE_TOO_FREQUENT', message: '' },
    });
    const response = await sendCodeRoute.POST(
      post('/api/portal/auth/send-verify-code', { email: 'a@b.test' }),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: { reason: 'VERIFY_CODE_TOO_FREQUENT' } });
  });
});

describe('公开开关缓存', () => {
  it('30 秒内只读一次后端，过期后重新读；失败不缓存', async () => {
    resetAuthSettingsCache();
    let clock = 0;
    const now = () => clock;
    backend.respond = () => ({ ok: true, data: { registration_enabled: false } });
    expect(await getAuthSettings(new Headers(), now)).toMatchObject({
      ok: true,
      data: { registrationEnabled: false },
    });
    clock = PUBLIC_SETTINGS_TTL_MS - 1;
    await getAuthSettings(new Headers(), now);
    expect(backend.calls).toHaveLength(1);
    clock = PUBLIC_SETTINGS_TTL_MS;
    backend.respond = () => ({
      ok: false,
      error: { status: 503, reason: 'PORTAL_BACKEND_UNAVAILABLE', message: '' },
    });
    expect((await getAuthSettings(new Headers(), now)).ok).toBe(false);
    backend.respond = () => ({ ok: true, data: { registration_enabled: true } });
    expect(await getAuthSettings(new Headers(), now)).toMatchObject({
      ok: true,
      data: { registrationEnabled: true },
    });
    expect(backend.calls).toHaveLength(3);
  });
});
