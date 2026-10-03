import type { Localized } from '@/lib/catalog';

import { createRandom, randomToken } from './random';
import {
  addDays,
  CONSOLE_NOW,
  dayKey,
  dayStart,
  HOUR_MS,
  inRange,
  presetRange,
  TODAY,
  type DateRange,
} from './time';
import { dailyTotals } from './usage';

/**
 * 钱包与流水（占位数据）。余额按美元结算：
 * 充值、赠送、兑换为正，调用消费按天汇成一条负数流水，余额由流水逐条累加得到。
 */
export type TxnType = 'recharge' | 'gift' | 'redeem' | 'consume' | 'refund';
export const TXN_TYPES: readonly TxnType[] = ['recharge', 'gift', 'redeem', 'consume', 'refund'];

export type PaymentMethod = 'alipay' | 'wechat' | 'stripe';
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['alipay', 'wechat', 'stripe'];

export interface Transaction {
  id: string;
  ts: number;
  type: TxnType;
  /** 正数入账，负数扣费 */
  amountUsd: number;
  method: PaymentMethod | null;
  note: Localized;
}

export interface LedgerEntry extends Transaction {
  /** 这笔之后的余额 */
  balanceUsd: number;
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

const random = createRandom('console-billing');
const txnId = () => `txn_${randomToken(random, 14)}`;
const at = (day: string, hour: number) => dayStart(day) + hour * HOUR_MS + 17 * 60_000;

/** 手工写的入账（充值、赠送、兑换） */
const CREDITS: readonly Omit<Transaction, 'id'>[] = [
  {
    ts: at('2026-04-12', 10),
    type: 'gift',
    amountUsd: 5,
    method: null,
    note: { zh: '注册赠送', en: 'Sign-up credit' },
  },
  {
    ts: at('2026-04-12', 11),
    type: 'recharge',
    amountUsd: 100,
    method: 'alipay',
    note: { zh: '支付宝充值', en: 'Alipay top-up' },
  },
  {
    ts: at('2026-06-01', 15),
    type: 'recharge',
    amountUsd: 200,
    method: 'stripe',
    note: { zh: '银行卡充值', en: 'Card top-up' },
  },
  {
    ts: at('2026-06-01', 15) + 1000,
    type: 'gift',
    amountUsd: 10,
    method: null,
    note: { zh: '充值满 $200 赠送 5%', en: '5% bonus on a $200 top-up' },
  },
  {
    ts: at('2026-07-01', 9),
    type: 'redeem',
    amountUsd: 20,
    method: null,
    note: { zh: '兑换码 NX-SUMMER-20', en: 'Redeem code NX-SUMMER-20' },
  },
  {
    ts: at('2026-08-15', 20),
    type: 'recharge',
    amountUsd: 200,
    method: 'wechat',
    note: { zh: '微信支付充值', en: 'WeChat Pay top-up' },
  },
  {
    ts: at('2026-08-15', 20) + 1000,
    type: 'gift',
    amountUsd: 10,
    method: null,
    note: { zh: '充值满 $200 赠送 5%', en: '5% bonus on a $200 top-up' },
  },
  {
    ts: at('2026-09-02', 11),
    type: 'refund',
    amountUsd: 1.86,
    method: null,
    note: { zh: '上游故障退还（工单 T-1007）', en: 'Upstream incident refund (ticket T-1007)' },
  },
  {
    ts: at('2026-09-20', 16),
    type: 'recharge',
    amountUsd: 100,
    method: 'alipay',
    note: { zh: '支付宝充值', en: 'Alipay top-up' },
  },
];

/** 每天的调用消费汇成一条，记在当天 23:59（今天记在现在） */
function consumption(): Omit<Transaction, 'id'>[] {
  const entries: Omit<Transaction, 'id'>[] = [];
  for (const [day, total] of dailyTotals()) {
    if (total.costUsd <= 0) continue;
    entries.push({
      ts: day === TODAY ? CONSOLE_NOW : dayStart(day) + 24 * HOUR_MS - 60_000,
      type: 'consume',
      amountUsd: -round6(total.costUsd),
      method: null,
      note: { zh: 'API 调用', en: 'API usage' },
    });
  }
  return entries;
}

/** 流水：按时间先后逐条累加余额，返回从新到旧 */
export function buildLedger(transactions: readonly Transaction[]): LedgerEntry[] {
  let balance = 0;
  const ascending = [...transactions]
    .sort((a, b) => a.ts - b.ts)
    .map((txn) => {
      balance = round6(balance + txn.amountUsd);
      return { ...txn, balanceUsd: balance };
    });
  return ascending.reverse();
}

export const TRANSACTIONS: readonly Transaction[] = [...CREDITS, ...consumption()].map((txn) => ({
  ...txn,
  id: txnId(),
}));

export const LEDGER: readonly LedgerEntry[] = buildLedger(TRANSACTIONS);

export const BALANCE_USD = LEDGER[0]?.balanceUsd ?? 0;

export interface BillingSummary {
  balanceUsd: number;
  /** 范围内的充值 */
  rechargedUsd: number;
  /** 范围内的赠送、兑换与退还 */
  bonusUsd: number;
  /** 范围内的消费（正数） */
  consumedUsd: number;
  /** 近 30 天日均消费 */
  dailyAvgUsd: number;
  /** 按近 30 天日均还能用多少天；没有消费时为 null */
  runwayDays: number | null;
}

export function billingSummary(ledger: readonly LedgerEntry[], range: DateRange): BillingSummary {
  const last30 = presetRange('last30d');
  let rechargedUsd = 0;
  let bonusUsd = 0;
  let consumedUsd = 0;
  let last30Consumed = 0;
  for (const entry of ledger) {
    const day = dayKey(entry.ts);
    if (entry.type === 'consume' && inRange(day, last30)) last30Consumed -= entry.amountUsd;
    if (!inRange(day, range)) continue;
    if (entry.type === 'recharge') rechargedUsd += entry.amountUsd;
    else if (entry.type === 'consume') consumedUsd -= entry.amountUsd;
    else bonusUsd += entry.amountUsd;
  }
  const balanceUsd = ledger[0]?.balanceUsd ?? 0;
  const dailyAvgUsd = last30Consumed / 30;
  return {
    balanceUsd,
    rechargedUsd: round2(rechargedUsd),
    bonusUsd: round2(bonusUsd),
    consumedUsd: round6(consumedUsd),
    dailyAvgUsd: round6(dailyAvgUsd),
    runwayDays: dailyAvgUsd > 0 ? Math.floor(balanceUsd / dailyAvgUsd) : null,
  };
}

export interface TxnFilter {
  range: DateRange;
  type: TxnType | 'all';
  /** 按金额绝对值筛，null 表示不限 */
  minUsd: number | null;
  maxUsd: number | null;
  /** 流水 ID（包含即可） */
  query: string;
}

export function filterTransactions(
  ledger: readonly LedgerEntry[],
  filter: TxnFilter,
): LedgerEntry[] {
  const q = filter.query.trim().toLowerCase();
  return ledger.filter((entry) => {
    const amount = Math.abs(entry.amountUsd);
    return (
      inRange(dayKey(entry.ts), filter.range) &&
      (filter.type === 'all' || entry.type === filter.type) &&
      (filter.minUsd === null || amount >= filter.minUsd) &&
      (filter.maxUsd === null || amount <= filter.maxUsd) &&
      (q === '' || entry.id.toLowerCase().includes(q))
    );
  });
}

/** 余额提醒设置（占位） */
export const BALANCE_ALERT = {
  thresholdUsd: 20,
  email: true,
  webhook: false,
  webhookUrl: '',
};

/** 余额低于提醒阈值时，账单页顶部显示提醒条 */
export function isLowBalance(balanceUsd: number, thresholdUsd: number): boolean {
  return balanceUsd < thresholdUsd;
}

/** 充值档位（美元） */
export const RECHARGE_PRESETS: readonly number[] = [10, 50, 100, 500];

/** 充值赠送（占位）：满 $200 送 5%，满 $500 送 10% */
export const RECHARGE_BONUS_TIERS: readonly { minUsd: number; rate: number }[] = [
  { minUsd: 500, rate: 0.1 },
  { minUsd: 200, rate: 0.05 },
];

export function rechargeBonus(amountUsd: number): number {
  const tier = RECHARGE_BONUS_TIERS.find((t) => amountUsd >= t.minUsd);
  return tier ? round2(amountUsd * tier.rate) : 0;
}

/** 充值金额限制（美元） */
export const RECHARGE_LIMITS = { min: 5, max: 10_000 };

/** 账单页默认看最近 30 天；月份切换用这个函数算某月范围 */
export function monthRange(year: number, month: number): DateRange {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const to = addDays(nextMonth, -1);
  return { preset: null, from, to: to > TODAY ? TODAY : to };
}
