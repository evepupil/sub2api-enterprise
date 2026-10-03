import {
  buildLedger,
  CONSOLE_NOW,
  RECHARGE_BONUS_TIERS,
  type LedgerEntry,
  type PaymentMethod,
  type Transaction,
  type TxnType,
} from '@/lib/console';
import { randomToken } from '@/lib/console/random';

/** 一次性的随机数（只在点击后的回调里用，渲染时不调用） */
function cryptoRandom(): number {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return (value ?? 0) / 2 ** 32;
}

/** 新流水 ID：和数据层一致，txn_ 加 14 位随机串 */
export function newTxnId(): string {
  return `txn_${randomToken(cryptoRandom, 14)}`;
}

/**
 * 本页新增的一笔正数流水，时间固定为「现在」。
 * 流水的说明要求中英两份，而本页新增的流水只在创建时的语言下出现，两份都写这段文字。
 */
export function newTransaction(
  type: TxnType,
  amountUsd: number,
  method: PaymentMethod | null,
  note: string,
): Transaction {
  return {
    id: newTxnId(),
    ts: CONSOLE_NOW,
    type,
    amountUsd,
    method,
    note: { zh: note, en: note },
  };
}

/**
 * 充值金额命中的赠送档位；没到最低档返回 undefined。
 * 档位表从高到低排，第一个满足的就是命中的档位（和 rechargeBonus 的取法一致）。
 */
export function bonusTierFor(amountUsd: number) {
  return RECHARGE_BONUS_TIERS.find((tier) => amountUsd >= tier.minUsd);
}

/**
 * 把新流水并进账本并重算每一笔之后的余额。
 * 账本是从新到旧排的，先翻成从旧到新再接上新流水：同一时刻的流水保持原来的先后，
 * 新流水排在最后（也就是最新）。
 */
export function appendTransactions(
  ledger: readonly LedgerEntry[],
  added: readonly Transaction[],
): LedgerEntry[] {
  return buildLedger([...[...ledger].reverse(), ...added]);
}
