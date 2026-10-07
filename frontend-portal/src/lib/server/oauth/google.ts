import type { OAuthError } from '@/lib/auth/oauth-errors';
import { tokenPairFrom, type CookieWrite, type TokenPair } from '@/lib/server/session/cookies';
import type { RelaySetCookie } from '@/lib/server/sub2api/relay';
import { safeNextPath } from '@/lib/session/guard';

export type { OAuthError };

/**
 * 谷歌登录（后台 sub2api 自带的「谷歌邮箱快捷登录」）在官网服务器这一侧的规则。纯函数，单测锁住。
 *
 * 流程：浏览器点「使用 Google 账号登录」→ 官网 start 替浏览器调后台 start，拿到谷歌授权地址和后台记状态的 cookie，
 * 把这些 cookie 存进官网自己的 cookie，再把浏览器送去谷歌 → 谷歌回到官网 callback（后台设置里的回调地址填这个）
 * → 官网带着存好的 cookie 替浏览器调后台 callback，读后台跳转地址 # 后面的结果：
 *   - 拿到令牌：写进登录 cookie，进控制台（令牌只经过官网服务器，页面脚本看不到）；
 *   - 新用户：后台给了「待完成注册」的 cookie，存起来，去「完成注册」页设密码（官网 pending、complete 两个接口转后台）；
 *   - 出错：回登录页显示原因。
 * 后台这几个 cookie 原本限定在后台的 /api/v1/auth/oauth 路径下，官网转存时限定在官网自己的谷歌登录接口下。
 */

/** 官网谷歌登录接口所在的路径；过程中的临时 cookie 只在这下面 */
export const OAUTH_COOKIE_PATH = '/api/portal/auth/oauth';
/** 发起登录时：后台记状态的 cookie、登录后去哪、哪种语言 */
export const OAUTH_STATE_COOKIE = 'portal_oauth_state';
/** 新用户：后台「待完成注册」的 cookie */
export const OAUTH_PENDING_COOKIE = 'portal_oauth_pending';
/** 临时 cookie 的有效期，和后台一致（10 分钟） */
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 600;

/** 后台 start 设的状态 cookie，没有它回调必然失败 */
export const BACKEND_STATE_COOKIE = 'email_oauth_state';
/** 后台 callback 给新用户设的两个待完成 cookie */
export const BACKEND_PENDING_COOKIES = [
  'oauth_pending_session',
  'oauth_pending_browser_session',
] as const;

export type OAuthLocale = 'zh' | 'en';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/* ---------- 发起 ---------- */

/** 浏览器发起时带来的参数（注册页会带上邀请码、组织等，后台在新用户完成注册时用） */
export interface StartParams {
  locale: OAuthLocale;
  /** 登录后去的控制台地址（不带语言前缀） */
  next: string;
  affCode?: string;
  promoCode?: string;
  organizationName?: string;
  memberName?: string;
  invitationCode?: string;
}

const LIMITS = { code: 128, organizationName: 100, memberName: 50 } as const;

function clip(value: string | null, max: number): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed === '' || Array.from(trimmed).length > max ? undefined : trimmed;
}

export function parseStartParams(search: URLSearchParams): StartParams {
  return {
    locale: search.get('locale') === 'en' ? 'en' : 'zh',
    next: safeNextPath(search.get('next')),
    affCode: clip(search.get('aff'), LIMITS.code),
    promoCode: clip(search.get('promo'), LIMITS.code),
    organizationName: clip(search.get('organization_name'), LIMITS.organizationName),
    memberName: clip(search.get('member_name'), LIMITS.memberName),
    invitationCode: clip(search.get('invitation_code'), LIMITS.code),
  };
}

/** 发给后台 start 的查询串。后台的回跳地址用不上（结果由官网服务器读），固定写控制台 */
export function backendStartQuery(params: StartParams): string {
  const query = new URLSearchParams({ redirect: '/console' });
  if (params.affCode) query.set('aff_code', params.affCode);
  if (params.promoCode) query.set('promo_code', params.promoCode);
  if (params.organizationName) query.set('organization_name', params.organizationName);
  if (params.memberName) query.set('member_name', params.memberName);
  if (params.invitationCode) query.set('invitation_code', params.invitationCode);
  return query.toString();
}

/** 后台给的谷歌授权地址：只接受 http(s) 的完整地址 */
export function authorizeUrlFrom(location: string | null): string | null {
  if (!location) return null;
  try {
    const url = new URL(location);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/* ---------- 官网自己的临时 cookie ---------- */

/** 存在官网临时 cookie 里的东西 */
export interface OAuthCookiePayload {
  /** 后台设的 cookie（名字 → 值） */
  cookies: Record<string, string>;
  next: string;
  locale: OAuthLocale;
}

/** cookie 名与值只收安全字符，拼回 Cookie 头时不会被插入别的内容 */
const COOKIE_NAME = /^[A-Za-z0-9_-]{1,64}$/;
const COOKIE_VALUE = /^[A-Za-z0-9_\-.~%=+/]{0,2048}$/;

/** 后台设的 cookie 整理成名字 → 值：去掉后台正在清除的，只留名字和值都安全的 */
export function cookieJar(
  setCookies: readonly RelaySetCookie[],
  only?: readonly string[],
): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const cookie of setCookies) {
    if (cookie.cleared) continue;
    if (only && !only.includes(cookie.name)) continue;
    if (!COOKIE_NAME.test(cookie.name) || !COOKIE_VALUE.test(cookie.value)) continue;
    jar[cookie.name] = cookie.value;
  }
  return jar;
}

export function encodeOAuthCookie(payload: OAuthCookiePayload): string {
  const raw = JSON.stringify({ c: payload.cookies, n: payload.next, l: payload.locale });
  return Buffer.from(raw, 'utf8').toString('base64url');
}

/** 读官网临时 cookie；格式不对时为 null（按「已过期」处理） */
export function decodeOAuthCookie(value: string | undefined): OAuthCookiePayload | null {
  if (!value) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!isRecord(raw) || !isRecord(raw.c)) return null;
  const cookies: Record<string, string> = {};
  for (const [name, cookieValue] of Object.entries(raw.c)) {
    if (
      typeof cookieValue === 'string' &&
      COOKIE_NAME.test(name) &&
      COOKIE_VALUE.test(cookieValue)
    ) {
      cookies[name] = cookieValue;
    }
  }
  return {
    cookies,
    next: safeNextPath(typeof raw.n === 'string' ? raw.n : null),
    locale: raw.l === 'en' ? 'en' : 'zh',
  };
}

/** 写一条官网临时 cookie（页面脚本读不到，只在谷歌登录接口下，10 分钟） */
export function oauthCookieWrite(name: string, value: string, secure: boolean): CookieWrite {
  return {
    name,
    value,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: OAUTH_COOKIE_PATH,
      secure,
      maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
    },
  };
}

/** 清掉一条官网临时 cookie（路径、安全选项要和写入时一致） */
export function clearedOAuthCookie(name: string, secure: boolean): CookieWrite {
  return {
    name,
    value: '',
    options: { httpOnly: true, sameSite: 'lax', path: OAUTH_COOKIE_PATH, secure, maxAge: 0 },
  };
}

/* ---------- 回调 ---------- */

export type CallbackOutcome =
  | { kind: 'signed_in'; pair: TokenPair }
  | { kind: 'pending' }
  | { kind: 'error'; error: OAuthError };

/** 后台回调跳转地址 # 后面的结果：令牌、错误，或者什么都没有（新用户，待完成注册） */
export function callbackOutcome(location: string | null): CallbackOutcome {
  if (!location) return { kind: 'error', error: 'failed' };
  let hash: string;
  try {
    hash = new URL(location, 'http://portal.invalid').hash;
  } catch {
    return { kind: 'error', error: 'failed' };
  }
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.has('access_token') || params.has('refresh_token')) {
    const pair = tokenPairFrom({
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
      expires_in: Number(params.get('expires_in')),
    });
    return pair ? { kind: 'signed_in', pair } : { kind: 'error', error: 'failed' };
  }
  if (params.has('error')) {
    return {
      kind: 'error',
      error: oauthErrorFor(params.get('error') ?? '', params.get('error_message') ?? ''),
    };
  }
  return { kind: 'pending' };
}

/** 后台的错误代码 → 登录页显示的原因 */
export function oauthErrorFor(code: string, message = ''): OAuthError {
  switch (code) {
    case 'provider_error':
      // 在谷歌那边点了取消，谷歌回 access_denied
      return message === 'access_denied' ? 'cancelled' : 'failed';
    case 'missing_params':
    case 'invalid_state':
      return 'expired';
    case 'USER_NOT_ACTIVE':
      return 'inactive';
    case 'EMAIL_SUFFIX_NOT_ALLOWED':
      return 'suffix';
    case 'USER_EMAIL_CONFLICT':
    case 'AUTH_IDENTITY_EMAIL_MISMATCH':
      return 'conflict';
    case 'login_blocked':
    case 'BACKEND_MODE_ADMIN_ONLY':
      return 'admin_only';
    case 'OAUTH_DISABLED':
    case 'OAUTH_CONFIG_INVALID':
      return 'disabled';
  }
  if (code.includes('CAPTCHA')) return 'captcha';
  return 'failed';
}

/** 后台 start / callback 没有跳转、直接回了错误（JSON）时的原因 */
export function failureFor(status: number, body: unknown): OAuthError {
  if (status === 429) return 'too_many';
  const reason = isRecord(body) && typeof body.reason === 'string' ? body.reason : '';
  return reason ? oauthErrorFor(reason) : 'failed';
}

/* ---------- 去哪 ---------- */

const prefix = (locale: OAuthLocale) => (locale === 'en' ? '/en' : '');

export function loginErrorPath(locale: OAuthLocale, error: OAuthError): string {
  return `${prefix(locale)}/login?oauth_error=${error}`;
}

/** 新用户的「完成注册」页 */
export function completePath(locale: OAuthLocale): string {
  return `${prefix(locale)}/register/google`;
}

/** 登录成功后去的控制台地址（next 已是不带语言前缀的控制台地址） */
export function afterLoginPath(locale: OAuthLocale, next: string): string {
  return `${prefix(locale)}${next}`;
}

/* ---------- 完成注册 ---------- */

/** 「完成注册」页要显示的：谷歌邮箱、是否必须填邀请码 */
export interface PendingInfo {
  email: string;
  invitationRequired: boolean;
}

/** 后台 pending/exchange 的 data → 完成注册页要的信息；看不懂时为 null */
export function pendingInfoFrom(data: unknown): PendingInfo | null {
  if (!isRecord(data)) return null;
  const email =
    typeof data.resolved_email === 'string' && data.resolved_email !== ''
      ? data.resolved_email
      : typeof data.email === 'string'
        ? data.email
        : '';
  if (email === '') return null;
  return {
    email,
    invitationRequired: data.invitation_required === true || data.error === 'invitation_required',
  };
}

export interface CompleteInput {
  password: string;
  invitationCode?: string;
  organizationName?: string;
  organizationMemberName?: string;
  affCode?: string;
}

const COMPLETE_LIMITS = {
  password: 512,
  code: 128,
  organizationName: 100,
  organizationMemberName: 50,
} as const;

/** 完成注册页提交的内容：密码 6–512 位（原样保留空格），其余选填、去首尾空格、限长；不合法时为 null */
export function parseCompleteInput(body: Record<string, unknown>): CompleteInput | null {
  const password = body.password;
  if (typeof password !== 'string' || password.length < 6) return null;
  if (password.length > COMPLETE_LIMITS.password) return null;
  const optional = (key: string, max: number): string | undefined | null => {
    const value = body[key];
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return Array.from(trimmed).length > max ? null : trimmed;
  };
  const invitationCode = optional('invitationCode', COMPLETE_LIMITS.code);
  const organizationName = optional('organizationName', COMPLETE_LIMITS.organizationName);
  const organizationMemberName = optional(
    'organizationMemberName',
    COMPLETE_LIMITS.organizationMemberName,
  );
  const affCode = optional('affCode', COMPLETE_LIMITS.code);
  if ([invitationCode, organizationName, organizationMemberName, affCode].includes(null)) {
    return null;
  }
  return {
    password,
    invitationCode: invitationCode ?? undefined,
    organizationName: organizationName ?? undefined,
    organizationMemberName: organizationMemberName ?? undefined,
    affCode: affCode ?? undefined,
  };
}

/** 发给后台 complete-registration 的请求体（字段名换成后台的写法，没填的不发） */
export function completeBackendBody(input: CompleteInput): Record<string, string> {
  const body: Record<string, string> = { password: input.password };
  if (input.invitationCode) body.invitation_code = input.invitationCode;
  if (input.organizationName) body.organization_name = input.organizationName;
  if (input.organizationMemberName) body.organization_member_name = input.organizationMemberName;
  if (input.affCode) body.aff_code = input.affCode;
  return body;
}
