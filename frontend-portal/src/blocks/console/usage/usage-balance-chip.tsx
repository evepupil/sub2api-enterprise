'use client';

import { Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/console/skeleton';
import { Link } from '@/i18n/navigation';
import { formatUsd } from '@/lib/console';
import { useBalanceSummary } from '@/lib/console/live/use-billing';

/**
 * 用量页标题行的余额卡片（2026-10-09 用户要求，照 sub2api 顶栏的余额）：钱包图标 + 可用余额，
 * 和时间范围、刷新同高，点了去账单页（充值、兑换码都在那里）。跟着用量页的「刷新」一起重读；
 * 还没读到时是同样大小的占位块，读不到时不显示，不影响用量页。
 */
export function UsageBalanceChip({ reloadKey }: { reloadKey: number }) {
  const t = useTranslations('consoleUsage');
  const summary = useBalanceSummary(reloadKey);

  if (summary.data === null) {
    return summary.error ? null : <Skeleton className="h-10 w-28 shrink-0" />;
  }
  const amount = formatUsd(summary.data.balanceUsd);
  return (
    <Link
      href="/console/billing"
      data-balance-chip
      title={t('balance.label')}
      aria-label={`${t('balance.label')} ${amount}`}
      className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-info-soft px-3 text-sm font-semibold tabular-nums text-info transition-colors hover:bg-info/20"
    >
      <Wallet aria-hidden className="size-4" />
      {amount}
    </Link>
  );
}

export default UsageBalanceChip;
