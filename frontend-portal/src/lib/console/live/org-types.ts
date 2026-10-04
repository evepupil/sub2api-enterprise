/**
 * 控制台组织页的真实数据：官网服务器把后端组织接口（/api/v1/organization*）整理成这个形状。
 * 规则照 sub2api 原有的组织功能：只有组织管理员（创建者）能管成员、邀请码、默认配额与配额申请；
 * 普通成员只能看自己的组织配额、提交和撤回配额申请（在用量页）。金额一律美元。
 */

export type OrgStatus = 'active' | 'disabled';

export interface OrgSummary {
  id: number;
  name: string;
  /** 是不是组织管理员（创建者） */
  isOwner: boolean;
  /** 组织被平台停用时成员的调用会被拒 */
  status: OrgStatus;
  createdAt: string;
}

/** 成员的周期配额：pending 是生效时间还没到（先沿用原来的上限），active 是正在生效 */
export interface OrgPeriodicQuota {
  mode: 'periodic_pending' | 'periodic_active';
  /** 每期金额 */
  amount: number;
  periodDays: number;
  startAt: string;
  windowStart: string | null;
  /** 这一期结束（下次重置）的时间 */
  windowEnd: string | null;
}

export type OrgMemberStatus = 'active' | 'disabled';

export interface OrgMember {
  userId: number;
  email: string;
  username: string;
  status: OrgMemberStatus;
  /** 组织管理员本人：不能停用、不能设配额 */
  isOwner: boolean;
  /** 在组织里的名称（管理员起的，可以为空） */
  displayName: string;
  /** 固定累计上限：null 不限额，0 不能消费 */
  spendingLimit: number | null;
  spendingUsed: number;
  /** 正在进行的调用先冻结的金额 */
  spendingFrozen: number;
  /** 剩余额度：不限额时为 null */
  spendingRemaining: number | null;
  /** 配了周期配额时有 */
  quota: OrgPeriodicQuota | null;
  joinedAt: string;
}

export type OrgMemberStatusFilter = OrgMemberStatus | 'all';

export interface OrgMembersQuery {
  page: number;
  pageSize: number;
  /** 按邮箱或用户名搜索，空串不限 */
  search: string;
  status: OrgMemberStatusFilter;
}

export interface OrgMembersPage {
  items: OrgMember[];
  total: number;
  page: number;
  pageSize: number;
}

/** 后端记的状态；过了有效期的「有效」邀请码，页面按「已过期」显示 */
export type OrgInvitationStatus = 'unused' | 'used' | 'disabled' | 'expired';

export interface OrgInvitation {
  id: number;
  code: string;
  status: OrgInvitationStatus;
  createdAt: string;
  /** null 表示长期有效 */
  expiresAt: string | null;
  usedAt: string | null;
}

/** 新成员默认的周期配额 */
export interface OrgDefaultQuota {
  enabled: boolean;
  amount: number | null;
  periodDays: number | null;
}

/** 配额申请方式：关闭、先审批再加、申请了就加 */
export type QuotaRequestMode = 'off' | 'approve' | 'auto';

export interface QuotaRequestPolicy {
  mode: QuotaRequestMode;
  /** 单次申请的最低、最高金额（不关闭时必填） */
  minAmount: number | null;
  maxAmount: number | null;
}

export type QuotaRequestStatus = 'pending' | 'granted' | 'rejected' | 'withdrawn';

export interface QuotaRequest {
  id: number;
  userId: number;
  email: string;
  username: string;
  displayName: string;
  amount: number;
  reason: string;
  status: QuotaRequestStatus;
  grantedAmount: number | null;
  /** 管理员审批时写的备注 */
  reviewNote: string;
  reviewedAt: string | null;
  createdAt: string;
}

export type QuotaRequestStatusFilter = QuotaRequestStatus | 'all';

export interface QuotaRequestsPage {
  items: QuotaRequest[];
  total: number;
  page: number;
  pageSize: number;
}

/** 普通成员看到的自己的组织配额（用量页的「组织配额」卡片） */
export interface MyOrgQuota {
  /** 还剩多少；null 是不限额 */
  remaining: number | null;
  /** 这一期结束（下次重置）的时间 */
  windowEnd: string | null;
  /** 管理员开了申请、而且这个成员能申请 */
  canRequest: boolean;
  requestMode: QuotaRequestMode;
  minAmount: number | null;
  maxAmount: number | null;
  /** 已经有一条还没处理的申请 */
  pendingExists: boolean;
}

/** 周期配额：每期金额、周期天数、从什么时候开始（null 是立即生效，当场开新的一期） */
export interface PeriodicQuotaInput {
  amount: number;
  periodDays: number;
  startAt: string | null;
}

/** 改一个成员：每次只改一项 */
export type MemberUpdate =
  | { kind: 'status'; status: OrgMemberStatus }
  | { kind: 'name'; displayName: string }
  /** 固定累计上限；null 改成不限额（会清掉周期配额） */
  | { kind: 'limit'; spendingLimit: number | null }
  /** 周期配额 */
  | { kind: 'quota'; quota: PeriodicQuotaInput };

/** 勾选多个成员后的批量操作 */
export type MemberBatch =
  /** 平分上限：总额按人数平分成各自的固定累计上限 */
  | { kind: 'split'; userIds: number[]; totalAmount: number }
  /** 周期发放：统一发同一份周期配额 */
  | { kind: 'quota'; userIds: number[]; quota: PeriodicQuotaInput };

export interface DefaultQuotaInput {
  enabled: boolean;
  amount: number | null;
  periodDays: number | null;
  /** 顺便发给现在还没配周期配额的成员 */
  syncUnconfigured: boolean;
  /** 顺便覆盖已经配过周期配额的成员（立即换新一期） */
  syncConfigured: boolean;
}

/** 审批一条申请：通过、驳回（可带备注），或者成员撤回自己的 */
export type QuotaRequestAction = 'approve' | 'reject' | 'withdraw';

/** 组织相关操作失败的原因，界面按语言写成一句话 */
export type OrgErrorReason =
  | 'owner_required'
  | 'not_in_org'
  | 'org_disabled'
  | 'member_not_found'
  | 'owner_immutable'
  | 'name_invalid'
  | 'amount_invalid'
  | 'period_invalid'
  | 'start_invalid'
  | 'no_targets'
  | 'request_disabled'
  | 'request_amount'
  | 'request_pending_exists'
  | 'request_ineligible'
  | 'request_handled'
  | 'request_not_found'
  | 'text_too_long'
  | 'range_invalid'
  | 'invalid'
  | 'forbidden'
  | 'too_many'
  | 'unavailable';
