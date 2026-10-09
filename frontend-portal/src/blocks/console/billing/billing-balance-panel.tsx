'use client';

import { ArrowUpRight, Plus, RotateCw, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Button, buttonClass } from '@/components/console/button';
import { Panel } from '@/components/console/panel';
import { Skeleton } from '@/components/console/skeleton';
import { formatUsd } from '@/lib/console';
import type { BalanceSummary } from '@/lib/console/live/billing-types';
import { balanceOutlook, isLowBalance } from '@/lib/console/live/billing-view';
import { cn } from '@/lib/utils';

/**
 * 累计三格里的一格：小标签加一个数字。还没拿到数据时数字位置放一条占位块。
 * 标签允许换行（英文标签较长、窄屏放不下时不截断），数字贴着格子底部，三个数字始终在同一条线上。
 */
function SummaryCell({
  id,
  label,
  value,
  valueClassName,
}: {
  id: string;
  label: ReactNode;
  value: string | null;
  valueClassName?: string;
}) {
  return (
    <div
      data-stat={id}
      className="flex min-w-0 flex-col justify-between gap-1 sm:px-6 sm:first:pl-0"
    >
      <p className="break-words text-xs text-subtle-foreground">{label}</p>
      {value === null ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <p
          data-stat-value
          className={cn(
            'truncate text-lg font-medium tabular-nums text-foreground',
            valueClassName,
          )}
        >
          {value}
        </p>
      )}
    </div>
  );
}

/**
 * 余额卡：大号可用余额、按当前速度的可用天数与日均、充值入口，下面是开户以来的累计充值、赠送、消耗。
 * 余额偏低（低于 US$1 或撑不过 3 天）时顶部出提示条，余额变成警示色。summary 为 null 时还在取；
 * 取不到时（error 不为 null 且手里没有旧数据）在余额位置给出原因与重试。
 */
export function BillingBalancePanel({
  summary,
  error,
  onRetry,
  onRecharge,
  rechargeUrl,
}: {
  summary: BalanceSummary | null;
  error: 'too_many' | 'unavailable' | null;
  onRetry: () => void;
  /** 在线支付的充值弹窗（还没接，控制台功能开关关着时不传） */
  onRecharge?: () => void;
  /** 卡网店铺地址：「充值」在新窗口打开它（2026-10-09 起用卡网）；两样都没有时不显示「充值」 */
  rechargeUrl?: string | null;
}) {
  const t = useTranslations('consoleBilling');
  const low = summary !== null && isLowBalance(summary);
  const outlook = summary === null ? null : balanceOutlook(summary);
  const hasBonus = summary !== null && summary.bonusUsd > 0;
  const hasConsumed = summary !== null && summary.consumedUsd > 0;

  return (
    <Panel id="balance">
      {low ? (
        <div
          role="status"
          data-low-balance
          className="mb-5 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">{t('balance.low')}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{t('balance.label')}</p>
          {summary === null && error !== null ? (
            <div
              role="alert"
              className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
            >
              <span>{error === 'too_many' ? t('errors.tooMany') : t('errors.unavailable')}</span>
              <Button variant="secondary" size="sm" data-balance-retry onClick={onRetry}>
                <RotateCw aria-hidden />
                {t('errors.retry')}
              </Button>
            </div>
          ) : summary === null ? (
            <Skeleton className="mt-2 h-10 w-48" />
          ) : (
            <p
              data-balance
              className={cn(
                'mt-1 truncate text-4xl font-semibold tracking-tight tabular-nums',
                low ? 'text-warning' : 'text-foreground',
              )}
            >
              {formatUsd(summary.balanceUsd)}
            </p>
          )}
          {/* 最近没有消耗时算不出可用天数，这一行不显示 */}
          {outlook?.runwayDays != null ? (
            <p data-runway className="mt-2 text-sm text-muted-foreground">
              {t('balance.runway', {
                days: outlook.runwayDays,
                avg: formatUsd(outlook.dailyAvgUsd),
              })}
            </p>
          ) : null}
        </div>
        {onRecharge ? (
          <Button size="lg" data-recharge onClick={onRecharge}>
            <Plus aria-hidden />
            {t('balance.recharge')}
          </Button>
        ) : rechargeUrl ? (
          <a
            href={rechargeUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-recharge="shop"
            className={buttonClass({ size: 'lg' })}
          >
            <Plus aria-hidden />
            {t('balance.recharge')}
            <ArrowUpRight aria-hidden />
          </a>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
        <SummaryCell
          id="recharged"
          label={t('stats.recharged')}
          value={summary === null ? null : formatUsd(summary.rechargedUsd)}
        />
        {/* 没有赠送、没有消耗时不加正负号，也不染色 */}
        <SummaryCell
          id="bonus"
          label={t('stats.bonus')}
          value={
            summary === null
              ? null
              : hasBonus
                ? `+${formatUsd(summary.bonusUsd)}`
                : formatUsd(summary.bonusUsd)
          }
          valueClassName={hasBonus ? 'text-success' : undefined}
        />
        <SummaryCell
          id="consumed"
          label={t('stats.consumed')}
          value={
            summary === null
              ? null
              : hasConsumed
                ? `-${formatUsd(summary.consumedUsd)}`
                : formatUsd(summary.consumedUsd)
          }
        />
      </div>
    </Panel>
  );
}
