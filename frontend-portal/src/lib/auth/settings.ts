/**
 * 登录注册页要用的后端公开开关（来自后端 /api/v1/settings/public 的一小部分）。
 * 纯函数，单测锁住；服务端转发接口和浏览器端共用这份形状。
 */
export interface AuthSettings {
  /** 是否开放注册；关闭时注册页只显示一句提示 */
  registrationEnabled: boolean;
  /** 注册前要不要先验证邮箱（发 6 位验证码） */
  emailVerifyEnabled: boolean;
  /** 是否显示优惠码输入框 */
  promoCodeEnabled: boolean;
  /** 邀请码是否必填（邀请码框始终显示，关闭时为选填） */
  invitationCodeEnabled: boolean;
  /** 是否显示邀请返利码输入框 */
  affiliateEnabled: boolean;
  /** 允许注册的邮箱后缀（如 @company.com、*.edu.cn）；空表示不限制 */
  emailSuffixWhitelist: string[];
  /** 开了「按邮箱域名限量注册」时，后缀由后端按额度判断，前端不做预检 */
  emailDomainQuotaEnabled: boolean;
  /** 后台开了任意一种人机验证（官网暂不支持，注册会被后端拒绝） */
  captchaEnabled: boolean;
  /** 后台开了注册前确认用户协议（官网暂不支持） */
  loginAgreementEnabled: boolean;
  passwordResetEnabled: boolean;
  googleOAuthEnabled: boolean;
}

/** 读不到后端设置时的兜底：和现有 sub2api 注册页的默认值一致 */
export const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  registrationEnabled: true,
  emailVerifyEnabled: false,
  promoCodeEnabled: true,
  invitationCodeEnabled: false,
  affiliateEnabled: false,
  emailSuffixWhitelist: [],
  emailDomainQuotaEnabled: false,
  captchaEnabled: false,
  loginAgreementEnabled: false,
  passwordResetEnabled: false,
  googleOAuthEnabled: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 官网接口返回的开关（已是本文件的形状）→ 逐项检查类型，缺失或不对时用兜底值 */
export function fromPortalSettings(raw: unknown): AuthSettings {
  if (!isRecord(raw)) return { ...DEFAULT_AUTH_SETTINGS };
  const result: AuthSettings = { ...DEFAULT_AUTH_SETTINGS };
  for (const key of Object.keys(DEFAULT_AUTH_SETTINGS) as (keyof AuthSettings)[]) {
    const value = raw[key];
    if (key === 'emailSuffixWhitelist') {
      if (Array.isArray(value)) {
        result.emailSuffixWhitelist = value.filter(
          (item): item is string => typeof item === 'string',
        );
      }
    } else if (typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
}

/** 后端公开设置（data 部分）→ 登录注册页要用的开关；字段缺失或类型不对时用兜底值 */
export function toAuthSettings(raw: unknown): AuthSettings {
  if (!isRecord(raw)) return { ...DEFAULT_AUTH_SETTINGS };
  const flag = (key: string, fallback: boolean) =>
    typeof raw[key] === 'boolean' ? (raw[key] as boolean) : fallback;
  const whitelist = Array.isArray(raw.registration_email_suffix_whitelist)
    ? raw.registration_email_suffix_whitelist.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];

  return {
    registrationEnabled: flag('registration_enabled', DEFAULT_AUTH_SETTINGS.registrationEnabled),
    emailVerifyEnabled: flag('email_verify_enabled', DEFAULT_AUTH_SETTINGS.emailVerifyEnabled),
    promoCodeEnabled: flag('promo_code_enabled', DEFAULT_AUTH_SETTINGS.promoCodeEnabled),
    invitationCodeEnabled: flag(
      'invitation_code_enabled',
      DEFAULT_AUTH_SETTINGS.invitationCodeEnabled,
    ),
    affiliateEnabled: flag('affiliate_enabled', DEFAULT_AUTH_SETTINGS.affiliateEnabled),
    emailSuffixWhitelist: whitelist,
    emailDomainQuotaEnabled: flag('registration_email_domain_quota_enabled', false),
    captchaEnabled:
      flag('turnstile_enabled', false) ||
      flag('tencent_captcha_enabled', false) ||
      flag('aliyun_captcha_enabled', false),
    loginAgreementEnabled: flag('login_agreement_enabled', false),
    passwordResetEnabled: flag('password_reset_enabled', false),
    googleOAuthEnabled: flag('google_oauth_enabled', false),
  };
}
