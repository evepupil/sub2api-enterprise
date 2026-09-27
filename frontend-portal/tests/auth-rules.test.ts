import { describe, expect, it } from 'vitest';
import { parseAuthSettings, CAPTCHA_PROVIDER_PRIORITY } from '../src/features/auth/auth-settings';
import { safeApiMessage } from '../src/features/auth/api-error';
import { safeReturnPath } from '../src/features/auth/redirect';
import { safeOAuthRedirect } from '../src/features/auth/oauth-utils';

function baseSettings(): Record<string, unknown> {
  return {
    registration_enabled: false,
    email_verify_enabled: false,
    password_reset_enabled: false,
    invitation_code_enabled: false,
    totp_enabled: false,
    turnstile_enabled: false,
    tencent_captcha_enabled: false,
    aliyun_captcha_enabled: false,
    github_oauth_enabled: false,
    google_oauth_enabled: false,
    linuxdo_oauth_enabled: false,
    oidc_oauth_enabled: false,
    wechat_oauth_enabled: false,
    dingtalk_oauth_enabled: false,
    passkey_enabled: false,
  };
}

describe('auth settings rules', () => {
  it('exposes only explicitly enabled login providers', () => {
    const settings = parseAuthSettings({
      ...baseSettings(),
      github_oauth_enabled: true,
      linuxdo_oauth_enabled: true,
      oidc_oauth_enabled: true,
      oidc_oauth_provider_name: 'Company SSO',
      wechat_oauth_open_enabled: true,
      google_oauth_enabled: 'true',
      dingtalk_oauth_enabled: 1,
    });

    expect(settings.oauthProviders).toEqual([
      { id: 'github', label: 'GitHub' },
      { id: 'linuxdo', label: 'LinuxDO' },
      { id: 'oidc', label: 'Company SSO' },
      { id: 'wechat', label: '微信' },
    ]);
    expect(settings.passkeyEnabled).toBe(false);
  });

  it('keeps captcha configuration fail-closed when an enabled provider is incomplete', () => {
    expect(() => parseAuthSettings({ ...baseSettings(), turnstile_enabled: true })).toThrow(
      'turnstile_site_key',
    );
    expect(() => parseAuthSettings({ ...baseSettings(), tencent_captcha_enabled: true })).toThrow(
      'tencent_captcha_app_id',
    );
    expect(() =>
      parseAuthSettings({
        ...baseSettings(),
        aliyun_captcha_enabled: true,
        aliyun_captcha_scene_id: 'scene-only',
      }),
    ).toThrow('scene_id 或 prefix');
  });

  it('ignores missing captcha details when the provider is disabled', () => {
    const settings = parseAuthSettings({
      ...baseSettings(),
      turnstile_site_key: '',
      tencent_captcha_app_id: null,
      aliyun_captcha_scene_id: 'unused-scene',
    });

    expect(settings.turnstileSiteKey).toBeNull();
    expect(settings.tencentAppId).toBeNull();
    expect(settings.aliyun).toBeNull();
  });

  it('preserves real agreement documents and does not invent terms content', () => {
    const settings = parseAuthSettings({
      ...baseSettings(),
      login_agreement_enabled: true,
      login_agreement_revision: '2026-09-27',
      login_agreement_documents: [
        {
          id: 'terms',
          title: '服务条款',
          content_md: '# 服务条款\n\n真实条款内容',
        },
        {
          id: 'privacy',
          title: '隐私政策',
          content_md: '真实隐私政策内容',
        },
        { id: '', title: '缺少编号', content_md: '不应进入结果' },
        { id: 'missing-title', title: ' ', content_md: '不应进入结果' },
        { id: 'not-an-object' },
      ],
    });

    expect(settings.agreement).toEqual({
      enabled: true,
      revision: '2026-09-27',
      documents: [
        { id: 'terms', title: '服务条款', content: '# 服务条款\n\n真实条款内容' },
        { id: 'privacy', title: '隐私政策', content: '真实隐私政策内容' },
      ],
    });

    const noDocuments = parseAuthSettings({
      ...baseSettings(),
      login_agreement_enabled: true,
      login_agreement_documents: [],
    });
    expect(noDocuments.agreement).toEqual({ enabled: false, revision: '', documents: [] });
  });

  it('keeps captcha provider priority explicit', () => {
    expect(CAPTCHA_PROVIDER_PRIORITY).toEqual(['turnstile', 'tencent', 'aliyun']);
  });

  it('maps invalid credentials to a safe message without exposing the backend payload', () => {
    const payload = {
      code: 401,
      reason: 'INVALID_CREDENTIALS',
      message: 'sensitive backend',
    } as const;
    const message = safeApiMessage(payload.code, payload.reason);

    expect(message).toBe('邮箱或密码不正确');
    expect(message).not.toContain(payload.message);
    expect(message).not.toContain(payload.reason);
  });
});

describe('safeReturnPath', () => {
  it('keeps an internal return path with query and hash', () => {
    expect(safeReturnPath('/console?tab=usage#today')).toBe('/console?tab=usage#today');
    expect(safeReturnPath('/login?next=https%3A%2F%2Fevil.example')).toBe(
      '/login?next=https%3A%2F%2Fevil.example',
    );
  });

  it.each([
    'https://evil.example/steal',
    '//evil.example/steal',
    '///evil.example/steal',
    '/%2f%2fevil.example/steal',
    '/%5c%5cevil.example/steal',
    '/\\evil.example\\steal',
    '/%E0%A4%A',
    'javascript:alert(1)',
  ])('falls back for an external or malformed return value: %s', (value) => {
    expect(safeReturnPath(value, '/console')).toBe('/console');
  });

  it('uses the fallback for missing input', () => {
    expect(safeReturnPath(undefined)).toBe('/console');
    expect(safeReturnPath('', '/login')).toBe('/login');
  });
});

describe('safeOAuthRedirect', () => {
  it('maps approved legacy destinations to the portal console', () => {
    expect(safeOAuthRedirect('/dashboard')).toBe('/console');
    expect(safeOAuthRedirect('/keys?tab=active#top')).toBe('/console/keys?tab=active#top');
    expect(safeOAuthRedirect('/payment')).toBe('/console/billing');
  });

  it.each(['https://evil.example/console', '//evil.example/console', '/admin', '/unknown'])(
    'falls back for an external or unknown legacy destination: %s',
    (value) => {
      expect(safeOAuthRedirect(value, '/console')).toBe('/console');
    },
  );
});
