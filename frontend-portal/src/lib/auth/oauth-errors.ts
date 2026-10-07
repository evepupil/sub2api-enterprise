/**
 * 谷歌登录失败时登录页显示的原因：官网服务器跳回登录页时写在 ?oauth_error= 里，登录页按它显示提示。
 * 浏览器与服务器共用，这个文件不引别的模块。
 */
export const OAUTH_ERRORS = [
  'cancelled',
  'expired',
  'failed',
  'disabled',
  'inactive',
  'suffix',
  'conflict',
  'admin_only',
  'captcha',
  'too_many',
] as const;

export type OAuthError = (typeof OAUTH_ERRORS)[number];

export function isOAuthError(value: unknown): value is OAuthError {
  return typeof value === 'string' && (OAUTH_ERRORS as readonly string[]).includes(value);
}
