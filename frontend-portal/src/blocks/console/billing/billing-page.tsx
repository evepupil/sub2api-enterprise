'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ConsolePage } from '@/components/console/console-page';
import {
  BALANCE_ALERT,
  billingSummary,
  formatPercent,
  isLowBalance,
  LEDGER,
  presetRange,
  rangeDays,
  rechargeBonus,
  type LedgerEntry,
  type PaymentMethod,
  type Transaction,
} from '@/lib/console';

import { BillingAlertPanel } from './billing-alert-panel';
import { BillingBalancePanel } from './billing-balance-panel';
import { appendTransactions, bonusTierFor, newTransaction } from './billing-ledger';
import { BillingRechargeDialog } from './billing-recharge-dialog';
import { BillingRedeemPanel } from './billing-redeem-panel';
import { REDEEM_AMOUNT_USD, formatUsdWhole, type AlertSettings } from './billing-rules';
import { BillingTransactions } from './billing-transactions';

/** 余额面板的汇总固定看近 30 天，和「按近 30 天日均估算可用天数」口径一致 */
const SUMMARY_RANGE = presetRange('last30d');
const SUMMARY_DAYS = rangeDays(SUMMARY_RANGE).length;

/**
 * 账单页：余额、兑换码、余额提醒、交易记录和充值弹窗。
 * 账本、提醒设置只放在本页的内存里：兑换、充值成功后往账本里追加正数流水并重算余额，
 * 余额面板、低余额提醒条和交易记录都从同一份账本算出来，所以会同步变化。
 */
export function BillingPage() {
  const t = useTranslations('consoleBilling');
  const [ledger, setLedger] = useState<LedgerEntry[]>(() => [...LEDGER]);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(() => ({ ...BALANCE_ALERT }));
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const summary = billingSummary(ledger, SUMMARY_RANGE);
  const low = isLowBalance(summary.balanceUsd, alertSettings.thresholdUsd);

  const addTransactions = (added: readonly Transaction[]) =>
    setLedger((current) => appendTransactions(current, added));

  /** 兑换成功：记一笔兑换流水 */
  const handleRedeemed = (code: string) =>
    addTransactions([
      newTransaction('redeem', REDEEM_AMOUNT_USD, null, t('txn.notes.redeem', { code })),
    ]);

  /** 支付成功：记一笔充值流水；金额满足赠送档位时再记一笔赠送流水 */
  const handlePaid = (amountUsd: number, method: PaymentMethod) => {
    const added = [
      newTransaction(
        'recharge',
        amountUsd,
        method,
        t('txn.notes.topup', { method: t(`methods.${method}`) }),
      ),
    ];
    const tier = bonusTierFor(amountUsd);
    if (tier) {
      added.push(
        newTransaction(
          'gift',
          rechargeBonus(amountUsd),
          null,
          t('txn.notes.bonus', {
            min: formatUsdWhole(tier.minUsd),
            rate: formatPercent(tier.rate, 0),
          }),
        ),
      );
    }
    addTransactions(added);
  };

  return (
    <ConsolePage id="billing" title={t('meta.title')}>
      <BillingBalancePanel
        summary={summary}
        spanDays={SUMMARY_DAYS}
        low={low}
        thresholdUsd={alertSettings.thresholdUsd}
        onRecharge={() => setRechargeOpen(true)}
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <BillingRedeemPanel onRedeemed={handleRedeemed} />
        <BillingAlertPanel settings={alertSettings} onSave={setAlertSettings} />
      </div>

      <BillingTransactions ledger={ledger} />

      <BillingRechargeDialog
        open={rechargeOpen}
        onOpenChange={setRechargeOpen}
        onPaid={handlePaid}
      />
    </ConsolePage>
  );
}
