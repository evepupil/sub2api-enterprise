/**
 * 邀请页（接后端）在官网服务器与浏览器之间传的形状。数据来自 sub2api 的邀请返利详情
 * GET /api/v1/user/aff；企业版后端让返利自动进余额，并在详情里带上返利规则的后台设置（技术设计 18.7）。
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

/** 返利规则（后台设置）；冻结期、有效期、单人上限为 0 表示不冻结、永久有效、不设上限 */
export interface AffiliateRules {
  /** 你作为邀请人生效的返利比例（百分数，10 表示 10%），专属比例优先 */
  ratePercent: number;
  /** 新返利冻结多少小时后才进余额 */
  freezeHours: number;
  /** 只算被邀请人注册后多少天内的充值 */
  durationDays: number;
  /** 一个被邀请人最多给你带来多少返利（美元） */
  perInviteeCapUsd: number;
}

export interface AffiliateDetail {
  /** 邀请码，拼进邀请链接 /register?aff= */
  code: string;
  rules: AffiliateRules;
  invited: number;
  /** 累计返利（含还没进余额的） */
  totalUsd: number;
  /** 还没进余额的返利：冻结中的，加上刚产生、正在自动转入的 */
  pendingUsd: number;
  /** 最近的被邀请人（后端最多给 100 个） */
  invitees: AffiliateInvitee[];
}

/** 页面要的结果：后台关了邀请返利时没有详情 */
export type AffiliateState = { enabled: false } | { enabled: true; detail: AffiliateDetail };
