import { reasonFromResponse } from '@/lib/session/client';
import type { AuthErrorReason } from '@/lib/session/types';

import { authRequest } from './register-client';

/**
 * 浏览器端调官网找回密码接口（/api/portal/auth/forgot-password、reset-password）。
 * 结果统一成「成功 / 失败原因」，界面按原因显示提示。
 */

export type PasswordResetResult = { ok: true } | { ok: false; reason: AuthErrorReason };

const isOk = (status: number, data: unknown) =>
  status === 200 &&
  typeof data === 'object' &&
  data !== null &&
  (data as { ok?: unknown }).ok === true;

/** 请后端给这个邮箱发重置链接；邮件语言跟着页面语言 */
export async function requestPasswordReset(
  email: string,
  locale: string,
): Promise<PasswordResetResult> {
  const { status, data } = await authRequest('/api/portal/auth/forgot-password', {
    email,
    locale,
  });
  return isOk(status, data)
    ? { ok: true }
    : { ok: false, reason: reasonFromResponse(status, data) };
}

/** 用重置链接里的邮箱和凭证设新密码 */
export async function resetPassword(
  email: string,
  token: string,
  password: string,
): Promise<PasswordResetResult> {
  const { status, data } = await authRequest('/api/portal/auth/reset-password', {
    email,
    token,
    password,
  });
  return isOk(status, data)
    ? { ok: true }
    : { ok: false, reason: reasonFromResponse(status, data) };
}
