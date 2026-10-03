'use client';

import { useTranslations } from 'next-intl';

import { Skeleton } from '@/components/console/skeleton';
import { StatCard } from '@/components/console/stat-card';
import {
  formatCompact,
  formatDuration,
  formatInteger,
  formatPercent,
  formatUsd,
  monthlyRunRate,
  type UsageSummary,
} from '@/lib/console';

/**
 * 顶部四张数字卡：Token、请求、平均耗时、消费。
 * 数字都跟着所选时间范围变；消费卡的大数字是本期计费，右上角用 days 折算成「每月约多少」。
 * summary 为 null 时还在加载，数字处显示占位块。成功率、首字耗时拿不到时那一行不显示。
 */
export function UsageStats({ summary, days }: { summary: UsageSummary | null; days: number }) {
  const t = useTranslations('consoleUsage');
  const loading = <Skeleton className="mt-1 h-7 w-24" />;

  if (!summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard id="tokens" label={t('stats.tokens')} value={loading} />
        <StatCard id="requests" label={t('stats.requests')} value={loading} />
        <StatCard id="latency" label={t('stats.latency')} value={loading} />
        <StatCard id="cost" label={t('stats.cost')} value={loading} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        id="tokens"
        label={t('stats.tokens')}
        aside={t('stats.cacheHit', { percent: formatPercent(summary.cacheHitRate) })}
        value={formatCompact(summary.totalTokens)}
        sub={t('stats.tokenParts', {
          input: formatCompact(summary.inputTokens),
          cache: formatCompact(summary.cacheTokens),
          output: formatCompact(summary.outputTokens),
        })}
      />
      <StatCard
        id="requests"
        label={t('stats.requests')}
        value={formatInteger(summary.requests)}
        sub={
          summary.successRate === null
            ? undefined
            : t('stats.success', { percent: formatPercent(summary.successRate, 2) })
        }
      />
      <StatCard
        id="latency"
        label={t('stats.latency')}
        value={formatDuration(summary.avgLatencyMs)}
        sub={
          summary.avgTtftMs === null
            ? undefined
            : t('stats.ttft', { value: formatDuration(summary.avgTtftMs) })
        }
      />
      <StatCard
        id="cost"
        label={t('stats.cost')}
        aside={t('stats.runRate', { amount: formatUsd(monthlyRunRate(summary.costUsd, days)) })}
        value={formatUsd(summary.costUsd)}
        sub={t('stats.billed')}
      />
    </div>
  );
}
