/**
 * 账单页（接后端）在官网服务器与浏览器之间传的形状。后端接口见技术设计 18.5：
 * 余额卡 /user/balance/summary，余额流水 /user/balance/ledger（只含余额变动，不含调用扣费）。
 */

/** 流水类型：在线充值、兑换码、优惠码赠送、邀请返利转入、管理员调整、退款 */
export const LEDGER_TYPES = [
  'recharge',
  'redeem',
  'promo',
  'affiliate',
  'admin',
  'refund',
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export function isLedgerType(value: unknown): value is LedgerType {
  return typeof value === 'string' && (LEDGER_TYPES as readonly string[]).includes(value);
}

/** 有中文名的来源：支付方式（后端的 payment_type）与几类非支付来源；认不出的来源原样显示 */
export const KNOWN_LEDGER_SOURCES = [
  'alipay',
  'alipay_direct',
  'wxpay',
  'wxpay_direct',
  'stripe',
  'card',
  'link',
  'easypay',
  'airwallex',
  'online',
  'redeem_code',
  'promo_code',
  'affiliate',
  'admin',
] as const;
export type KnownLedgerSource = (typeof KNOWN_LEDGER_SOURCES)[number];

export function isKnownLedgerSource(value: string): value is KnownLedgerSource {
  return (KNOWN_LEDGER_SOURCES as readonly string[]).includes(value);
}

/** 余额卡：可用余额与开户以来的累计；最近一段时间的消耗用来算日均与可用天数 */
export interface BalanceSummary {
  balanceUsd: number;
  /** 在线充值加管理员加款 */
  rechargedUsd: number;
  /** 兑换码、优惠码与邀请返利转入 */
  bonusUsd: number;
  /** 按钱包计费的调用扣费合计 */
  consumedUsd: number;
  recentConsumedUsd: number;
  recentDays: number;
}

/** 一笔余额变动 */
export interface LedgerEntry {
  /** 流水号：rc_ 兑换记录、pc_ 优惠码、rf_ 退款，后面接记录 ID */
  id: string;
  type: LedgerType;
  /** 在线充值与退款是支付方式（alipay、wxpay、stripe 等），其余是 redeem_code、promo_code、affiliate、admin */
  source: string;
  /** 带正负号：收入为正，管理员扣减与退款为负 */
  amountUsd: number;
  /** 这一笔之后的余额 */
  balanceAfterUsd: number;
  /** 充值与退款是订单号，兑换码与优惠码是码本身 */
  reference: string;
  /** 管理员调整的备注、退款原因 */
  note: string;
  /** 毫秒时间戳 */
  ts: number;
}

/** 一页流水，外加这个账号流水里出现过的全部来源（筛选下拉用） */
export interface LedgerPage {
  items: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  sources: string[];
}

/** 浏览器要的那一页流水：分页、筛选条件；日期按北京时间，不填就不限 */
export interface LedgerQuery {
  page: number;
  pageSize: number;
  type: LedgerType | null;
  source: string | null;
  /** 订单号、兑换码或流水号的一部分 */
  query: string;
  minUsd: number | null;
  maxUsd: number | null;
  from: string | null;
  to: string | null;
}

/** 兑换失败的原因，按原因显示提示 */
export const REDEEM_ERRORS = [
  'not_found',
  'used',
  'expired',
  'busy',
  'too_many',
  'unavailable',
] as const;
export type RedeemError = (typeof REDEEM_ERRORS)[number];

/** 兑换成功后后端回的码类型与面值；余额码的面值是美元，并发数、订阅码各有单位 */
export interface RedeemResult {
  type: string;
  value: number;
}
