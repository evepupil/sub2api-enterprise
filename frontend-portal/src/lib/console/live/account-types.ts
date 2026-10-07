/**
 * 账户设置（改用户名、改登录密码）在浏览器和官网服务器之间约定的失败原因。
 * 当前密码不对、太频繁、提交的内容不合法、后台暂时不可用。
 */
export const ACCOUNT_ERROR_REASONS = [
  'password_incorrect',
  'too_many',
  'invalid',
  'unavailable',
] as const;

export type AccountErrorReason = (typeof ACCOUNT_ERROR_REASONS)[number];

/** 用户名最多多少个字（后台上限 100，界面收得更紧，避免撑破头像菜单） */
export const USERNAME_MAX = 32;
