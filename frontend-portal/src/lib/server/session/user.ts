import type { SessionUser } from '@/lib/session/types';

/**
 * 后端用户对象 → 浏览器能看到的当前用户。只挑界面要用的几项，余额、限额等等以后接对应页面时再加。
 * 纯函数，单测锁住。后端字段不全或类型不对时返回 null，按「没登录」处理。
 */
export function toSessionUser(raw: unknown): SessionUser | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const user = raw as Record<string, unknown>;
  if (typeof user.id !== 'number' || typeof user.email !== 'string') return null;

  const org = user.organization;
  let organization: SessionUser['organization'] = null;
  if (typeof org === 'object' && org !== null) {
    const record = org as Record<string, unknown>;
    if (typeof record.id === 'number' && typeof record.name === 'string') {
      organization = { id: record.id, name: record.name, isOwner: record.is_owner === true };
    }
  }

  return {
    id: user.id,
    email: user.email,
    username: typeof user.username === 'string' ? user.username : '',
    role: user.role === 'admin' ? 'admin' : 'user',
    organization,
    createdAt:
      typeof user.created_at === 'string' && !Number.isNaN(Date.parse(user.created_at))
        ? user.created_at
        : null,
  };
}
