import { EMAIL_PATTERN, PASSWORD_MIN_LENGTH } from './register-form';

/**
 * 找回密码的规则，照 sub2api 原来的找回密码、重置密码两页。纯函数，单测锁住。
 *
 * - 找回密码页只填邮箱；不管邮箱有没有注册，后端都回成功（防止被拿来试探谁注册过）。
 * - 邮件里的重置链接是 `{后台前端地址}/reset-password?email=…&token=…`，30 分钟内有效、只能用一次。
 * - 新密码至少 6 位（和注册一致），要输两遍。
 */

/** 邮箱、凭证、密码的长度上限（和注册转发接口一致，防止超长请求） */
export const RESET_LIMITS = { email: 254, token: 512, password: 512 } as const;

export type ResetEmailError = 'emailRequired' | 'emailInvalid';

/** 找回密码页的邮箱：空着或格式不对时给出原因 */
export function resetEmailError(email: string): ResetEmailError | null {
  const trimmed = email.trim();
  if (trimmed === '') return 'emailRequired';
  return EMAIL_PATTERN.test(trimmed) && trimmed.length <= RESET_LIMITS.email
    ? null
    : 'emailInvalid';
}

export interface ResetLink {
  email: string;
  token: string;
}

/** 从重置链接的查询参数里取邮箱和凭证；缺了或格式不对时为 null（页面提示链接无效） */
export function readResetLink(search: string): ResetLink | null {
  const params = new URLSearchParams(search);
  const email = (params.get('email') ?? '').trim();
  const token = (params.get('token') ?? '').trim();
  if (resetEmailError(email) !== null) return null;
  if (token === '' || token.length > RESET_LIMITS.token) return null;
  return { email, token };
}

export interface NewPasswordErrors {
  password?: 'passwordRequired' | 'passwordShort';
  confirm?: 'confirmRequired' | 'confirmMismatch';
}

/** 新密码与确认：新密码至少 6 位，确认要一模一样 */
export function newPasswordErrors(password: string, confirm: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {};
  if (password === '') errors.password = 'passwordRequired';
  else if (password.length < PASSWORD_MIN_LENGTH) errors.password = 'passwordShort';
  if (confirm === '') errors.confirm = 'confirmRequired';
  else if (confirm !== password) errors.confirm = 'confirmMismatch';
  return errors;
}
