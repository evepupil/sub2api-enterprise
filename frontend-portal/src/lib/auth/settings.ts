/**
 * 官网要用的后端公开设置（来自后端 /api/v1/settings/public 的一小部分）：登录注册页的开关、
 * 控制台的邀请返利开关与充值链接。纯函数，单测锁住；服务端转发接口和浏览器端共用这份形状。
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
  /**
   * 后台开了 Cloudflare 人机验证时的站点公钥（登录、注册、找回密码页要先过验证），没开是 ''。
   * 后台开的是腾讯、阿里的验证码时官网不支持，这里也是 ''，提交时后台会拒绝并提示验证不可用。
   */
  turnstileSiteKey: string;
  passwordResetEnabled: boolean;
  googleOAuthEnabled: boolean;
  /**
   * 充值地址（后台「余额不足提醒」里的充值链接，2026-10-09 起放卡网店铺地址）：控制台账单页的「充值」
   * 与「购买兑换码」在新窗口打开它。没填、或不是 http(s) 地址时为 ''，两个入口都不显示。
   */
  rechargeUrl: string;
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
  turnstileSiteKey: '',
  passwordResetEnabled: false,
  googleOAuthEnabled: false,
  rechargeUrl: '',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 只认 http(s) 的完整地址（防止后台填进 javascript: 之类的链接），整理成标准写法；其余为 '' */
export function httpUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

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
    } else if (key === 'turnstileSiteKey') {
      if (typeof value === 'string') result.turnstileSiteKey = value;
    } else if (key === 'rechargeUrl') {
      result.rechargeUrl = httpUrl(value);
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
    turnstileSiteKey:
      flag('turnstile_enabled', false) && typeof raw.turnstile_site_key === 'string'
        ? raw.turnstile_site_key.trim()
        : '',
    passwordResetEnabled: flag('password_reset_enabled', false),
    googleOAuthEnabled: flag('google_oauth_enabled', false),
    rechargeUrl: httpUrl(raw.balance_low_notify_recharge_url),
  };
}
