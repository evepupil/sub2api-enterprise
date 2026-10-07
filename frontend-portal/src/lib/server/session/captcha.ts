/**
 * 人机验证（Cloudflare Turnstile）的验证结果：浏览器提交登录、注册、发验证码、找回密码时带 captchaToken，
 * 官网服务器按后台的字段名 turnstile_token 转过去，由后台去 Cloudflare 核验。纯函数，单测锁住。
 */

/** Cloudflare 的验证结果最长 2048 个字符 */
export const CAPTCHA_TOKEN_MAX = 2048;

/** 请求体里的验证结果：没带是 ''；类型不对或超长是 null（按请求有误处理，不转给后台） */
export function captchaTokenFrom(body: Record<string, unknown>): string | null {
  const value = body.captchaToken;
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > CAPTCHA_TOKEN_MAX) return null;
  return value;
}

/** 有验证结果时带上 turnstile_token；后台没开人机验证时不带也不影响 */
export function withCaptcha<T extends Record<string, unknown>>(
  body: T,
  token: string,
): T & { turnstile_token?: string } {
  return token === '' ? body : { ...body, turnstile_token: token };
}
