'use client';

import { useTranslations } from 'next-intl';

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
 * 数字都跟着所选时间范围变；days 用来把本期消费折算成「每月约多少」。
 */
export function UsageStats({ summary, days }: { summary: UsageSummary; days: number }) {
  const t = useTranslations('consoleUsage');

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
        sub={t('stats.success', { percent: formatPercent(summary.successRate, 2) })}
      />
      <StatCard
        id="latency"
        label={t('stats.latency')}
        value={formatDuration(summary.avgLatencyMs)}
        sub={t('stats.ttft', { value: formatDuration(summary.avgTtftMs) })}
      />
      <StatCard
        id="cost"
        label={t('stats.cost')}
        aside={t('stats.runRate', { amount: formatUsd(monthlyRunRate(summary.costUsd, days)) })}
        value={formatUsd(summary.costUsd)}
        // 生图张数传数字：千分位和英文单复数交给文案里的格式处理
        sub={t('stats.images', { count: summary.images })}
      />
    </div>
  );
}
