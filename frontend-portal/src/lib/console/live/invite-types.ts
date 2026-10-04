/**
 * 邀请页（接后端）在官网服务器与浏览器之间传的形状。数据来自 sub2api 原有的邀请返利：
 * GET /api/v1/user/aff（详情）、POST /api/v1/user/aff/transfer（返利转入余额），见技术设计 18.7。
 */

/** 一个被邀请人；邮箱后端已经打过码 */
export interface AffiliateInvitee {
  id: string;
  email: string;
  username: string;
  /** 注册时间（毫秒时间戳）；后端没给时为 null */
  joinedAt: number | null;
  /** 这个人给你带来的返利合计 */
  rebateUsd: number;
}

export interface AffiliateDetail {
  /** 邀请码，拼进邀请链接 /register?aff= */
  code: string;
  /** 你作为邀请人生效的返利比例（百分数，10 表示 10%） */
  ratePercent: number;
  invited: number;
  /** 可以转入余额的返利 */
  availableUsd: number;
  /** 还在冻结期的返利 */
  frozenUsd: number;
  /** 历史返利合计 */
  totalUsd: number;
  /** 最近的被邀请人（后端最多给 100 个） */
  invitees: AffiliateInvitee[];
}

/** 页面要的结果：后台关了邀请返利时没有详情 */
export type AffiliateState = { enabled: false } | { enabled: true; detail: AffiliateDetail };

/** 转入余额成功：转了多少、转完后的余额 */
export interface AffiliateTransfer {
  transferredUsd: number;
  balanceUsd: number;
}

/** 转入余额失败的原因：没有可转的、太频繁、服务不可用 */
export const TRANSFER_ERRORS = ['empty', 'too_many', 'unavailable'] as const;
export type TransferError = (typeof TRANSFER_ERRORS)[number];
