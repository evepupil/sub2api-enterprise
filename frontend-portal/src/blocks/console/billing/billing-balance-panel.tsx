'use client';

import { Plus, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Panel } from '@/components/console/panel';
import { Button } from '@/components/ui/button';
import { formatUsd, type BillingSummary } from '@/lib/console';
import { cn } from '@/lib/utils';

/**
 * 汇总里的一格：小标签加一个数字。
 * 标签允许换行（英文标签较长、窄屏放不下时不截断），数字贴着格子底部，
 * 这样同一行三格里即使只有一个标签换了行，三个数字也在同一条线上。
 */
function SummaryCell({
  label,
  value,
  valueClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-1">
      <p className="break-words text-xs text-subtle-foreground">{label}</p>
      <p
        className={cn('truncate text-lg font-medium tabular-nums text-foreground', valueClassName)}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * 余额面板：大号余额、充值入口、近期充值 / 赠送 / 消费三项合计。
 * 余额低于提醒阈值时，面板顶部出现提醒条，余额也跟着变成警示色。
 */
export function BillingBalancePanel({
  summary,
  spanDays,
  low,
  thresholdUsd,
  onRecharge,
}: {
  summary: BillingSummary;
  /** 汇总覆盖的天数（近 30 天） */
  spanDays: number;
  low: boolean;
  thresholdUsd: number;
  onRecharge: () => void;
}) {
  const t = useTranslations('consoleBilling');
  const hasBonus = summary.bonusUsd > 0;
  const hasConsumed = summary.consumedUsd > 0;

  return (
    <Panel id="balance">
      {low ? (
        <div
          role="status"
          data-low-balance
          className="mb-5 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            {t('balance.low', { threshold: formatUsd(thresholdUsd) })}
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{t('balance.label')}</p>
          <p
            data-balance
            className={cn(
              'mt-1 truncate text-4xl font-semibold tracking-tight tabular-nums',
              low ? 'text-warning' : 'text-foreground',
            )}
          >
            {formatUsd(summary.balanceUsd)}
          </p>
          {summary.runwayDays !== null ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t('balance.runway', {
                span: spanDays,
                avg: formatUsd(summary.dailyAvgUsd),
                days: summary.runwayDays,
              })}
            </p>
          ) : null}
        </div>
        <Button size="lg" data-recharge onClick={onRecharge}>
          <Plus aria-hidden />
          {t('balance.recharge')}
        </Button>
      </div>

      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
        <SummaryCell
          label={t('stats.recharged', { span: spanDays })}
          value={formatUsd(summary.rechargedUsd)}
        />
        {/* 没有赠送、没有消费时不加正负号，也不染色 */}
        <SummaryCell
          label={t('stats.bonus', { span: spanDays })}
          value={hasBonus ? `+${formatUsd(summary.bonusUsd)}` : formatUsd(summary.bonusUsd)}
          valueClassName={hasBonus ? 'text-success' : undefined}
        />
        <SummaryCell
          label={t('stats.consumed', { span: spanDays })}
          value={
            hasConsumed ? `-${formatUsd(summary.consumedUsd)}` : formatUsd(summary.consumedUsd)
          }
        />
      </div>
    </Panel>
  );
}
