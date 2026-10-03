import type { EditionId, Localized } from '@/lib/catalog';

/**
 * 组织（占位数据）。当前账号是组织管理员：组织统一付费，成员按月配额消费，
 * 成员只能在组织授权的通道（分组）里创建密钥。
 */
export const ORGANIZATION: {
  id: string;
  name: Localized;
  createdAt: string;
  /** 组织可用的通道（分组） */
  groups: readonly EditionId[];
} = {
  id: 'acme-ai',
  name: { zh: '示例科技', en: 'Acme AI' },
  createdAt: '2026-04-12',
  groups: ['personal', 'pro'],
};

export type MemberRole = 'admin' | 'member';
export type MemberStatus = 'active' | 'disabled';

export interface OrgMember {
  id: string;
  name: Localized;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  /** 每月配额（美元），null 表示不限 */
  quotaUsd: number | null;
  /** 本月已用（美元） */
  usedUsd: number;
  keys: number;
  joinedAt: string;
}

export const ORG_MEMBERS: readonly OrgMember[] = [
  {
    id: 'm-1',
    name: { zh: '林舟', en: 'Lin Zhou' },
    email: 'linzhou@example.com',
    role: 'admin',
    status: 'active',
    quotaUsd: null,
    usedUsd: 18.42,
    keys: 2,
    joinedAt: '2026-04-12',
  },
  {
    id: 'm-2',
    name: { zh: '陈思远', en: 'Siyuan Chen' },
    email: 'siyuan@example.com',
    role: 'member',
    status: 'active',
    quotaUsd: 50,
    usedUsd: 41.3,
    keys: 1,
    joinedAt: '2026-05-20',
  },
  {
    id: 'm-3',
    name: { zh: '王一然', en: 'Yiran Wang' },
    email: 'yiran@example.com',
    role: 'member',
    status: 'active',
    quotaUsd: 30,
    usedUsd: 6.85,
    keys: 1,
    joinedAt: '2026-06-03',
  },
  {
    id: 'm-4',
    name: { zh: '赵可', en: 'Ke Zhao' },
    email: 'zhaoke@example.com',
    role: 'member',
    status: 'active',
    quotaUsd: 30,
    usedUsd: 30,
    keys: 1,
    joinedAt: '2026-07-01',
  },
  {
    id: 'm-5',
    name: { zh: '孙悦', en: 'Yue Sun' },
    email: 'sunyue@example.com',
    role: 'member',
    status: 'disabled',
    quotaUsd: 20,
    usedUsd: 0,
    keys: 0,
    joinedAt: '2026-08-18',
  },
];

export type InvitationStatus = 'active' | 'used' | 'expired';

export interface OrgInvitation {
  code: string;
  createdAt: string;
  expiresAt: string;
  status: InvitationStatus;
  /** 已使用时，使用者的邮箱 */
  usedBy: string | null;
}

export const ORG_INVITATIONS: readonly OrgInvitation[] = [
  {
    code: 'ORG-8F2K-Q7LM',
    createdAt: '2026-09-30',
    expiresAt: '2026-10-07',
    status: 'active',
    usedBy: null,
  },
  {
    code: 'ORG-3C9D-W1PZ',
    createdAt: '2026-08-12',
    expiresAt: '2026-08-19',
    status: 'used',
    usedBy: 'sunyue@example.com',
  },
  {
    code: 'ORG-6T4R-H8NB',
    createdAt: '2026-07-02',
    expiresAt: '2026-07-09',
    status: 'expired',
    usedBy: null,
  },
];

/** 配额使用比例 0–1；不限额时为 null */
export function quotaRatio(member: OrgMember): number | null {
  if (member.quotaUsd === null || member.quotaUsd <= 0) return null;
  return Math.min(1, member.usedUsd / member.quotaUsd);
}

export interface OrgSummary {
  members: number;
  active: number;
  monthUsedUsd: number;
  /** 有上限的成员配额合计 */
  quotaTotalUsd: number;
}

export function orgSummary(members: readonly OrgMember[]): OrgSummary {
  return {
    members: members.length,
    active: members.filter((m) => m.status === 'active').length,
    monthUsedUsd: Math.round(members.reduce((sum, m) => sum + m.usedUsd, 0) * 100) / 100,
    quotaTotalUsd: members.reduce((sum, m) => sum + (m.quotaUsd ?? 0), 0),
  };
}
