import { PASSWORD_MIN_LENGTH } from '@/lib/auth/register-form';
import { USERNAME_MAX, type AccountErrorReason } from '@/lib/console/live/account-types';

import type { BackendError } from './envelope';

/**
 * 控制台账户设置的后端对接：改用户名（PUT /user）、改登录密码（PUT /user/password）。
 * 纯函数，单测锁住。改密码成功后后端会让这个账号所有已登录的凭证失效（包括当前这一个），
 * 所以官网接口在成功时顺手清掉登录 cookie，页面提示用新密码重新登录。
 */

export const PROFILE_PATH = '/user';
export const PASSWORD_PATH = '/user/password';

export interface ProfileInput {
  username: string;
}

export interface PasswordInput {
  current: string;
  next: string;
}

/** 浏览器提交的用户名：去掉首尾空格后 1–32 个字；不合法时为 null（回 400） */
export function parseProfileInput(raw: unknown): ProfileInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = (raw as Record<string, unknown>).username;
  if (typeof value !== 'string') return null;
  const username = value.trim();
  if (username === '' || Array.from(username).length > USERNAME_MAX) return null;
  return { username };
}

/** 浏览器提交的密码：当前密码必填，新密码至少 6 位且和当前密码不同；密码里的空格原样保留 */
export function parsePasswordInput(raw: unknown): PasswordInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const { current, next } = record;
  if (typeof current !== 'string' || typeof next !== 'string') return null;
  if (current === '' || next.length < PASSWORD_MIN_LENGTH || next === current) return null;
  return { current, next };
}

export const profilePayload = (input: ProfileInput) => ({ username: input.username });

export const passwordPayload = (input: PasswordInput) => ({
  old_password: input.current,
  new_password: input.next,
});

export function accountErrorFor(error: BackendError): AccountErrorReason {
  if (error.reason === 'PASSWORD_INCORRECT') return 'password_incorrect';
  if (error.status === 429) return 'too_many';
  if (error.status >= 500) return 'unavailable';
  return 'invalid';
}

export function accountErrorStatus(reason: AccountErrorReason): number {
  switch (reason) {
    case 'password_incorrect':
    case 'invalid':
      return 400;
    case 'too_many':
      return 429;
    case 'unavailable':
      return 503;
  }
}
