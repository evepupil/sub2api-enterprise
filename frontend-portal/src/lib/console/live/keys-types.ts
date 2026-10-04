/**
 * 控制台 API 密钥页的真实数据：官网服务器把后端密钥接口（/api/v1/keys）整理成这个形状。
 * 密钥页要能显示、复制完整密钥，所以列表带着完整密钥（只有登录账号自己的密钥，和 sub2api 一样）。
 * 金额一律美元。
 */

/** 后端的四种状态：启用、已暂停（手动停用）、额度用完、已过期 */
export type KeyStatus = 'active' | 'inactive' | 'quota_exhausted' | 'expired';

export const KEY_STATUSES: readonly KeyStatus[] = [
  'active',
  'inactive',
  'quota_exhausted',
  'expired',
];

export interface KeyGroupRef {
  id: number;
  name: string;
  /** 生效倍率：账号有专属倍率时用专属倍率 */
  rate: number;
}

/** 三个限速窗口（美元）：5 小时、1 天、7 天；限额为 0 表示不限 */
export interface KeyWindows {
  h5: number;
  d1: number;
  d7: number;
}

export interface KeyUsage {
  last30: { requests: number; costUsd: number };
  today: { requests: number; costUsd: number };
}

export interface LiveKey {
  id: number;
  name: string;
  /** 完整密钥 */
  secret: string;
  /** 绑定的分组；后端记录没有分组时为 null */
  group: KeyGroupRef | null;
  status: KeyStatus;
  ipWhitelist: string[];
  ipBlacklist: string[];
  /** 额度上限，0 表示不限 */
  quota: number;
  quotaUsed: number;
  /** 到期时间（ISO），null 表示永久 */
  expiresAt: string | null;
  createdAt: string;
  rateLimits: KeyWindows;
  /** 各限速窗口里已经花了多少 */
  rateUsage: KeyWindows;
  /** 近 30 天与今天的用量（北京时间）；后端用量统计读不到时为 null */
  usage: KeyUsage | null;
}

export interface KeysPageData {
  items: LiveKey[];
  total: number;
  page: number;
  pageSize: number;
}

export type KeyStatusFilter = KeyStatus | 'all';

export interface KeysQuery {
  page: number;
  pageSize: number;
  /** 按名称或密钥搜索，空串不限 */
  search: string;
  status: KeyStatusFilter;
}

/** 创建、修改密钥时能选的分组（账号能用的） */
export interface KeyGroupOption {
  id: number;
  name: string;
  description: string;
  rate: number;
}

/** 创建密钥：官网服务器校验过的请求 */
export interface KeyCreateInput {
  name: string;
  groupId: number;
  /** 自定义密钥；null 由后端生成 */
  customKey: string | null;
  ipWhitelist: string[];
  ipBlacklist: string[];
  /** 0 表示不限 */
  quota: number;
  /** 多少天后到期；null 表示永久 */
  expiresInDays: number | null;
  rateLimits: KeyWindows;
}

/** 修改密钥：只带要改的项 */
export interface KeyUpdateInput {
  name?: string;
  groupId?: number;
  status?: 'active' | 'inactive';
  ipWhitelist?: string[];
  ipBlacklist?: string[];
  quota?: number;
  /** 到期时间（ISO）；空串表示改成永久 */
  expiresAt?: string;
  rateLimits?: KeyWindows;
  /** 把已用额度清零 */
  resetQuota?: boolean;
  /** 把三个限速窗口的用量清零 */
  resetRateUsage?: boolean;
}

/** 创建、修改、删除失败的原因，界面按语言写成一句话 */
export type KeyErrorReason =
  | 'key_exists'
  | 'key_too_short'
  | 'key_invalid_chars'
  | 'invalid_ip'
  | 'group_not_allowed'
  | 'not_found'
  | 'invalid'
  | 'forbidden'
  | 'too_many'
  | 'unavailable';
