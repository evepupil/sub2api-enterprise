import type { OrgMember } from '@/lib/console';

/**
 * 组织页的成员规则（纯函数，不碰界面）：搜索、配额提醒档位、配额输入换算。
 */

export const QUOTA_MIN = 1;
export const QUOTA_MAX = 100_000;

/** 配额用到这个比例开始提醒（黄色），用满变红 */
const QUOTA_WARNING_RATIO = 0.8;

export type QuotaMode = 'unlimited' | 'custom';
export type QuotaLevel = 'ok' | 'warning' | 'full';

/** 已用比例 → 档位：不到 80% 正常，80% 起提醒，用满为红色并标「已用完」 */
export function quotaLevel(ratio: number): QuotaLevel {
  if (ratio >= 1) return 'full';
  if (ratio >= QUOTA_WARNING_RATIO) return 'warning';
  return 'ok';
}

/** 配额输入 → 金额；不是 1 到 100000 之间的数字时返回 null，金额保留两位小数 */
export function parseQuota(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < QUOTA_MIN || value > QUOTA_MAX) return null;
  return Math.round(value * 100) / 100;
}

/** 按姓名（中英文都认）或邮箱搜索，不分大小写 */
export function filterMembers(members: readonly OrgMember[], query: string): OrgMember[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...members];
  return members.filter(
    (member) =>
      member.name.zh.toLowerCase().includes(q) ||
      member.name.en.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q),
  );
}

/** 头像圆里显示的字：姓名的第一个字符 */
export function memberInitial(name: string): string {
  return (Array.from(name)[0] ?? '').toUpperCase();
}

/** 管理员不能被停用或移除，只能调整配额 */
export function isAdmin(member: OrgMember): boolean {
  return member.role === 'admin';
}
