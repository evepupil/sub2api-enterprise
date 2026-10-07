import { afterEach, describe, expect, it } from 'vitest';

import {
  clearReferralCode,
  loadReferralCode,
  referralCodeFromQuery,
  REFERRAL_TTL_MS,
  storeReferralCode,
} from '@/lib/auth/affiliate';
import {
  formatSuffixesForMessage,
  isEmailSuffixAllowed,
  normalizeSuffixWhitelist,
} from '@/lib/auth/email-suffix';
import {
  EMPTY_REGISTER_VALUES,
  IDLE,
  isCreatingOrganization,
  needsMemberName,
  registerPayload,
  submitBlockFor,
  validateRegister,
  type CodeCheck,
  type RegisterContext,
} from '@/lib/auth/register-form';
import {
  DEFAULT_AUTH_SETTINGS,
  fromPortalSettings,
  toAuthSettings,
  type AuthSettings,
} from '@/lib/auth/settings';
import { authReasonFor } from '@/lib/server/session/reasons';

const settings = (patch: Partial<AuthSettings> = {}): AuthSettings => ({
  ...DEFAULT_AUTH_SETTINGS,
  ...patch,
});
const ctx = (patch: Partial<RegisterContext> = {}): RegisterContext => ({
  settings: settings(),
  creatingOrganization: false,
  invitation: IDLE,
  ...patch,
});
const orgInvite: CodeCheck = { status: 'valid', kind: 'organization' };
const platformInvite: CodeCheck = { status: 'valid', kind: 'platform' };
const filled = { ...EMPTY_REGISTER_VALUES, email: 'a@b.test', password: '123456' };

describe('后端公开开关', () => {
  it('从后端字段名转成注册页用的开关，任意一种人机验证开着就算开', () => {
    const result = toAuthSettings({
      registration_enabled: true,
      email_verify_enabled: true,
      invitation_code_enabled: true,
      promo_code_enabled: false,
      affiliate_enabled: true,
      registration_email_suffix_whitelist: ['@corp.test', 3],
      tencent_captcha_enabled: true,
    });
    expect(result).toMatchObject({
      registrationEnabled: true,
      emailVerifyEnabled: true,
      invitationCodeEnabled: true,
      promoCodeEnabled: false,
      affiliateEnabled: true,
      emailSuffixWhitelist: ['@corp.test'],
      turnstileSiteKey: '',
    });
  });

  it('读不到或字段类型不对时用兜底值（与现有注册页一致）', () => {
    expect(toAuthSettings(null)).toEqual(DEFAULT_AUTH_SETTINGS);
    expect(toAuthSettings({ registration_enabled: 'yes' }).registrationEnabled).toBe(true);
    expect(fromPortalSettings({ emailVerifyEnabled: true, promoCodeEnabled: 'x' })).toMatchObject({
      emailVerifyEnabled: true,
      promoCodeEnabled: DEFAULT_AUTH_SETTINGS.promoCodeEnabled,
    });
  });
});

describe('邮箱后缀白名单', () => {
  it('统一写法、去掉不合法和重复的项', () => {
    expect(
      normalizeSuffixWhitelist(['Corp.Test', '@corp.test', '*.EDU.cn', 'bad domain', '*']),
    ).toEqual(['@corp.test', '*.edu.cn']);
  });

  it('@ 写法只允许这个域名，*. 写法允许它和所有子域名，空白名单不限制', () => {
    const list = ['@corp.test', '*.edu.cn'];
    expect(isEmailSuffixAllowed('a@corp.test', list)).toBe(true);
    expect(isEmailSuffixAllowed('a@sub.corp.test', list)).toBe(false);
    expect(isEmailSuffixAllowed('a@edu.cn', list)).toBe(true);
    expect(isEmailSuffixAllowed('a@pku.edu.cn', list)).toBe(true);
    expect(isEmailSuffixAllowed('a@gmail.com', list)).toBe(false);
    expect(isEmailSuffixAllowed('a@gmail.com', [])).toBe(true);
  });

  it('提示里最多列 5 个，其余写成「等 N 个」', () => {
    const list = ['@a.test', '@b.test', '@c.test', '@d.test', '@e.test', '@f.test', '@g.test'];
    expect(formatSuffixesForMessage(list, '、', (n) => `等 ${n} 个`)).toBe(
      '@a.test、@b.test、@c.test、@d.test、@e.test、等 2 个',
    );
  });
});

describe('注册表单校验', () => {
  it('必填、邮箱格式、密码至少 6 位', () => {
    expect(validateRegister(EMPTY_REGISTER_VALUES, ctx())).toEqual({
      email: 'emailRequired',
      password: 'passwordRequired',
    });
    expect(validateRegister({ ...filled, email: 'abc', password: '12345' }, ctx())).toEqual({
      email: 'emailInvalid',
      password: 'passwordShort',
    });
    expect(validateRegister(filled, ctx())).toEqual({});
  });

  it('邀请码只在开了邀请码注册时必填', () => {
    expect(
      validateRegister(filled, ctx({ settings: settings({ invitationCodeEnabled: true }) })),
    ).toEqual({
      invite: 'inviteRequired',
    });
    expect(validateRegister(filled, ctx())).toEqual({});
  });

  it('白名单预检：开了按域名限量注册时交给后端', () => {
    const whitelist = ['@corp.test'];
    expect(
      validateRegister(filled, ctx({ settings: settings({ emailSuffixWhitelist: whitelist }) })),
    ).toEqual({
      email: 'emailSuffix',
    });
    expect(
      validateRegister(
        filled,
        ctx({
          settings: settings({ emailSuffixWhitelist: whitelist, emailDomainQuotaEnabled: true }),
        }),
      ),
    ).toEqual({});
  });

  it('创建组织要组织名称和组织内名称；组织邀请码只能加入，要组织内名称', () => {
    expect(validateRegister(filled, ctx({ creatingOrganization: true }))).toEqual({
      orgName: 'orgNameRequired',
      memberName: 'memberNameRequired',
    });
    expect(validateRegister(filled, ctx({ invitation: orgInvite }))).toEqual({
      memberName: 'memberNameRequired',
    });
    // 组织邀请码优先：即使选了创建组织，也按加入处理
    const both = ctx({ creatingOrganization: true, invitation: orgInvite });
    expect(isCreatingOrganization(both)).toBe(false);
    expect(validateRegister(filled, both)).toEqual({ memberName: 'memberNameRequired' });
    // 平台邀请码不需要组织内名称
    expect(needsMemberName(ctx({ invitation: platformInvite }))).toBe(false);
  });
});

describe('提交前的邀请码与优惠码', () => {
  const values = { ...filled, invite: 'INV', promo: 'PROMO' };

  it('填了的必须校验通过，校验中也不能提交', () => {
    expect(submitBlockFor(values, { status: 'checking' }, IDLE)).toBe('promoChecking');
    expect(submitBlockFor(values, { status: 'invalid', errorCode: 'X' }, IDLE)).toBe(
      'promoInvalid',
    );
    expect(submitBlockFor(values, { status: 'valid' }, { status: 'checking' })).toBe(
      'inviteChecking',
    );
    expect(submitBlockFor(values, { status: 'valid' }, { status: 'invalid', errorCode: 'X' })).toBe(
      'inviteInvalid',
    );
    expect(submitBlockFor(values, { status: 'valid' }, platformInvite)).toBeNull();
  });

  it('没填的不拦；还没校验过的邀请码交给提交时再校验', () => {
    expect(
      submitBlockFor(
        filled,
        { status: 'invalid', errorCode: 'X' },
        { status: 'invalid', errorCode: 'X' },
      ),
    ).toBeNull();
    expect(submitBlockFor(values, IDLE, IDLE)).toBeNull();
  });
});

describe('发给后端的注册内容', () => {
  it('个人注册只带填了的项，去掉首尾空格', () => {
    expect(
      registerPayload(
        { ...filled, email: ' a@b.test ', invite: ' INV ', promo: ' ', aff: 'AFF' },
        ctx(),
        ' 123456 ',
      ),
    ).toEqual({
      email: 'a@b.test',
      password: '123456',
      verifyCode: '123456',
      invitationCode: 'INV',
      promoCode: undefined,
      affCode: 'AFF',
      organizationName: undefined,
      organizationMemberName: undefined,
    });
  });

  it('创建组织带组织名称与组织内名称；组织邀请码加入不带组织名称', () => {
    const values = { ...filled, orgName: 'Acme', memberName: '林舟' };
    expect(registerPayload(values, ctx({ creatingOrganization: true }))).toMatchObject({
      organizationName: 'Acme',
      organizationMemberName: '林舟',
    });
    expect(
      registerPayload(
        { ...values, invite: 'ORG' },
        ctx({ creatingOrganization: true, invitation: orgInvite }),
      ),
    ).toMatchObject({
      organizationName: undefined,
      organizationMemberName: '林舟',
      invitationCode: 'ORG',
    });
  });

  it('后台关了优惠码时不带优惠码', () => {
    expect(
      registerPayload(
        { ...filled, promo: 'P' },
        ctx({ settings: settings({ promoCodeEnabled: false }) }),
      ).promoCode,
    ).toBeUndefined();
  });
});

describe('邀请返利码', () => {
  const store = new Map<string, string>();
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  };
  (globalThis as unknown as { window: typeof fakeWindow }).window = fakeWindow;
  afterEach(() => store.clear());

  it('网址里 ?aff= 或 ?aff_code= 取第一个非空的', () => {
    expect(referralCodeFromQuery('?aff=A1')).toBe('A1');
    expect(referralCodeFromQuery('?aff=&aff_code=B2')).toBe('B2');
    expect(referralCodeFromQuery('?x=1')).toBe('');
  });

  it('存 30 天，过期后读不到并清掉', () => {
    storeReferralCode('A1', 1000);
    expect(loadReferralCode(1000 + REFERRAL_TTL_MS - 1)).toBe('A1');
    expect(loadReferralCode(1000 + REFERRAL_TTL_MS)).toBe('');
    storeReferralCode('B2', 0);
    clearReferralCode();
    expect(loadReferralCode(1)).toBe('');
  });
});

describe('注册错误归类', () => {
  it('后端注册错误码同名照搬，优惠码与人机验证归类', () => {
    const reason = (code: string, status = 400) =>
      authReasonFor({ status, reason: code, message: '' });
    expect(reason('EMAIL_EXISTS', 409)).toBe('EMAIL_EXISTS');
    expect(reason('INVALID_VERIFY_CODE')).toBe('INVALID_VERIFY_CODE');
    expect(reason('ORGANIZATION_REGISTRATION_CONFLICT')).toBe('ORGANIZATION_REGISTRATION_CONFLICT');
    expect(reason('PROMO_CODE_EXPIRED')).toBe('PROMO_CODE_INVALID');
    expect(reason('TURNSTILE_VERIFICATION_FAILED')).toBe('CAPTCHA_FAILED');
    expect(reason('VERIFY_CODE_TOO_FREQUENT', 429)).toBe('VERIFY_CODE_TOO_FREQUENT');
  });
});
