/**
 * 邀请返利（占位数据）。规则：被邀请人注册后 30 天内每次充值，邀请人得到充值额 10% 的返利；
 * 被邀请人首次充值额外得到 5% 赠送。返利先冻结 7 天（覆盖退款窗口），到期后转入余额。
 */
export const INVITE_PROGRAM = {
  code: 'NX7QK2',
  link: 'https://nexus-api.example/r/NX7QK2',
  inviterRate: 0.1,
  inviteeBonusRate: 0.05,
  windowDays: 30,
  freezeDays: 7,
};

export type InviteeStatus = 'pending' | 'frozen' | 'released';

export interface Invitee {
  id: string;
  /** 已打码的邮箱 */
  email: string;
  registeredAt: string;
  /** 返利窗口内累计充值（美元） */
  rechargedUsd: number;
  /** 已产生的返利（美元） */
  rebateUsd: number;
  /** 未充值 / 冻结中 / 已到账 */
  status: InviteeStatus;
}

export const INVITEES: readonly Invitee[] = [
  {
    id: 'inv-1',
    email: 'w***@gmail.com',
    registeredAt: '2026-08-03',
    rechargedUsd: 120,
    rebateUsd: 12,
    status: 'released',
  },
  {
    id: 'inv-2',
    email: 'c***@outlook.com',
    registeredAt: '2026-09-11',
    rechargedUsd: 50,
    rebateUsd: 5,
    status: 'released',
  },
  {
    id: 'inv-3',
    email: 'l***@qq.com',
    registeredAt: '2026-09-29',
    rechargedUsd: 30,
    rebateUsd: 3,
    status: 'frozen',
  },
  {
    id: 'inv-4',
    email: 'k***@163.com',
    registeredAt: '2026-10-02',
    rechargedUsd: 0,
    rebateUsd: 0,
    status: 'pending',
  },
];

export interface InviteStats {
  invited: number;
  /** 至少充值过一次的被邀请人 */
  effective: number;
  totalRebateUsd: number;
  releasedUsd: number;
  frozenUsd: number;
}

export function inviteStats(invitees: readonly Invitee[]): InviteStats {
  const sum = (status: InviteeStatus) =>
    invitees.filter((i) => i.status === status).reduce((total, i) => total + i.rebateUsd, 0);
  return {
    invited: invitees.length,
    effective: invitees.filter((i) => i.rechargedUsd > 0).length,
    totalRebateUsd: invitees.reduce((total, i) => total + i.rebateUsd, 0),
    releasedUsd: sum('released'),
    frozenUsd: sum('frozen'),
  };
}
