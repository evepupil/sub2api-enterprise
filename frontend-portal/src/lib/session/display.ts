import type { SessionUser } from './types';

/**
 * 当前用户在界面上的显示方式。纯函数，单测锁住。
 */

/** 显示名：有用户名用用户名，没有就用邮箱 @ 前面那段 */
export function displayName(user: SessionUser): string {
  const username = user.username.trim();
  if (username !== '') return username;
  const at = user.email.indexOf('@');
  return at > 0 ? user.email.slice(0, at) : user.email;
}

/** 头像里的字：显示名的第一个字，英文字母转大写；按字符而不是按编码单元取，避免把表情或生僻字切成半个 */
export function avatarInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : '';
}
