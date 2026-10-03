/**
 * 登录凭证的 cookie：名字、有效期和安全选项。纯函数，单测锁住。
 *
 * 后端登录成功会给两样凭证：访问凭证（默认 24 小时）和续期凭证（默认 30 天）。两样都放进
 * 页面脚本读不到的 cookie（HttpOnly），浏览器之后的请求自动带上，由官网服务器取出来加到发往后端的请求头里。
 * 访问凭证的 cookie 比凭证本身早一分钟过期：cookie 没了就说明该续期了，不会带着刚好过期的凭证去请求后端。
 */

export const ACCESS_COOKIE = 'portal_at';
export const REFRESH_COOKIE = 'portal_rt';
/** 两步验证那一步要用的临时凭证，只在登录过程中短暂存在 */
export const TWO_FACTOR_COOKIE = 'portal_2fa';

/** 续期凭证 cookie 的有效期：和后端默认的续期凭证有效期一致，30 天 */
export const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
/** 两步验证临时凭证的 cookie 有效期，5 分钟 */
export const TWO_FACTOR_MAX_AGE_SECONDS = 5 * 60;
/** 访问凭证 cookie 提前过期的秒数 */
export const ACCESS_EXPIRY_MARGIN_SECONDS = 60;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** 访问凭证的有效秒数（后端给的） */
  expiresIn: number;
}

export interface CookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  path: '/';
  secure: boolean;
  maxAge: number;
}

export interface CookieWrite {
  name: string;
  value: string;
  options: CookieOptions;
}

/** 浏览器到官网这一段是不是 https：直连看地址，经反向代理或隧道看 X-Forwarded-Proto */
export function isSecureRequest(url: string, headers: Headers): boolean {
  const forwarded = headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (forwarded) return forwarded === 'https';
  return url.startsWith('https:');
}

function options(secure: boolean, maxAge: number): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', path: '/', secure, maxAge };
}

/** 登录或续期成功后要写入的两条 cookie */
export function sessionCookieWrites(pair: TokenPair, secure: boolean): CookieWrite[] {
  const accessMaxAge = Math.max(pair.expiresIn - ACCESS_EXPIRY_MARGIN_SECONDS, 1);
  return [
    { name: ACCESS_COOKIE, value: pair.accessToken, options: options(secure, accessMaxAge) },
    {
      name: REFRESH_COOKIE,
      value: pair.refreshToken,
      options: options(secure, REFRESH_MAX_AGE_SECONDS),
    },
  ];
}

/** 两步验证临时凭证 */
export function twoFactorCookieWrite(tempToken: string, secure: boolean): CookieWrite {
  return {
    name: TWO_FACTOR_COOKIE,
    value: tempToken,
    options: options(secure, TWO_FACTOR_MAX_AGE_SECONDS),
  };
}

/** 清掉 cookie：同名写空值、有效期 0（安全选项要和写入时一致，浏览器才会认作同一条） */
export function clearedCookieWrites(names: readonly string[], secure: boolean): CookieWrite[] {
  return names.map((name) => ({ name, value: '', options: options(secure, 0) }));
}

export const SESSION_COOKIE_NAMES = [ACCESS_COOKIE, REFRESH_COOKIE] as const;

/** 后端登录或续期接口的 data 里取出凭证；缺字段时返回 null */
export function tokenPairFrom(data: unknown): TokenPair | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  const accessToken = record.access_token;
  const refreshToken = record.refresh_token;
  const expiresIn = record.expires_in;
  if (typeof accessToken !== 'string' || accessToken === '') return null;
  if (typeof refreshToken !== 'string' || refreshToken === '') return null;
  return {
    accessToken,
    refreshToken,
    expiresIn: typeof expiresIn === 'number' && expiresIn > 0 ? expiresIn : 24 * 60 * 60,
  };
}
