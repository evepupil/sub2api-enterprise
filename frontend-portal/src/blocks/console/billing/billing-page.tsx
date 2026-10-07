'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ConsolePage } from '@/components/console/console-page';
import { CONSOLE_FEATURES } from '@/lib/console/features';
import { useLiveClock } from '@/lib/console/live/use-live-clock';
import { useBalanceSummary } from '@/lib/console/live/use-billing';
import { usageSince } from '@/lib/console/live/usage-view';
import { useSession } from '@/lib/session/session-provider';

import { BillingBalancePanel } from './billing-balance-panel';
import { BillingRechargeDialog } from './billing-recharge-dialog';
import { BillingRedeemPanel } from './billing-redeem-panel';
import { BillingTransactions } from './billing-transactions';

/**
 * 账单页（接后端）：余额卡、兑换码、交易记录与充值弹窗。
 * 余额卡与交易记录都读后端；兑换成功后两份一起重新取。充值还没接真实支付，弹窗只是界面，
 * 首发按控制台功能开关不显示（用兑换码），以后照 sub2api 原来的下单流程接。交易记录的「今天」用浏览器的真实时间（北京时间），挂载后才读。
 */
export function BillingPage() {
  const t = useTranslations('consoleBilling');
  const clock = useLiveClock();
  const { user } = useSession();
  const [reloadKey, setReloadKey] = useState(0);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const summary = useBalanceSummary(reloadKey);
  const today = clock?.today ?? null;
  const since = today === null ? null : usageSince(user?.createdAt ?? null, today);
  const reload = () => setReloadKey((key) => key + 1);

  return (
    <ConsolePage id="billing" title={t('meta.title')}>
      <BillingBalancePanel
        summary={summary.data}
        error={summary.error}
        onRetry={reload}
        onRecharge={CONSOLE_FEATURES.recharge ? () => setRechargeOpen(true) : undefined}
      />
      <BillingRedeemPanel onRedeemed={reload} />
      <BillingTransactions today={today} since={since} reloadKey={reloadKey} />
      {CONSOLE_FEATURES.recharge ? (
        <BillingRechargeDialog open={rechargeOpen} onOpenChange={setRechargeOpen} />
      ) : null}
    </ConsolePage>
  );
}
