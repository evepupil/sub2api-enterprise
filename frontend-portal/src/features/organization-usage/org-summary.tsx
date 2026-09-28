'use client';

/**
 * 组织用量页面 15 的摘要卡与 Token 趋势卡。
 *
 * 契约来源：design/team-and-delivery.md 页面 15、organization-usage/types.ts。
 *
 * 边界：
 * - 只消费 UsageOverview 的已聚合结果（summary / trend），不在展示层重新聚合。
 * - 金额与数字统一走 features/usage/usage-format，与 M3 个人用量口径一致。
 * - 加载与错误状态由父组件负责，这里只渲染成功数据。
 */

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { MetricCard } from '../../components/console/metric-card';
import { Skeleton } from '../../components/ui/skeleton';
import { LineChart } from '../../components/charts/line-chart';
import { CircleDollarSign, Clock3, Database, MessagesSquare } from 'lucide-react';
import type { UsageOverview } from '../usage/types';
import {
  formatUsageDateLabel,
  formatUsageNumber,
  formatUsageSeconds,
  formatUsageUsd,
} from '../usage/usage-format';

const compactTokenFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

function formatCompactToken(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Math.abs(value) < 1000 ? formatUsageNumber(value) : compactTokenFormatter.format(value);
}

/**
 * 四张摘要卡：请求、总 Token、实际消费 USD、平均耗时；Token 四类分项合计放进
 * 下方「Token 使用趋势」卡的图例，不在这里重复列出。
 * 统计对象（全组织或选定成员）由父组件在筛选区说明，卡片本身不重复标注。
 */
export function OrganizationSummaryCards({ overview }: { overview: UsageOverview }) {
  const summary = overview.summary;
  return (
    <div
      className="grid min-w-0 gap-4 md:auto-rows-fr md:grid-cols-2 xl:grid-cols-4"
      role="group"
      aria-label="组织用量摘要"
    >
      <MetricCard
        label="总请求数"
        value={formatUsageNumber(summary.requests)}
        icon={MessagesSquare}
      />
      <MetricCard
        label="总 Token"
        value={formatCompactToken(summary.tokens.total)}
        icon={Database}
      />
      <MetricCard
        label="总消费"
        value={formatUsageUsd(summary.actualCost)}
        icon={CircleDollarSign}
      />
      <MetricCard
        label="平均耗时"
        value={formatUsageSeconds(summary.averageDurationMs)}
        icon={Clock3}
      />
    </div>
  );
}

/** 概览加载占位：与摘要卡同布局，避免内容跳动。 */
export function OrganizationSummarySkeleton() {
  return (
    <div
      className="grid min-w-0 gap-4 md:auto-rows-fr md:grid-cols-2 xl:grid-cols-4"
      aria-busy="true"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="h-full gap-4 py-4">
          <CardContent className="space-y-4 px-5 pt-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** 四类 Token 趋势：输入、输出、缓存写入、缓存读取，标签复用 M3 日期文案。 */
export function OrganizationTrendCard({ overview }: { overview: UsageOverview }) {
  const labels = overview.trend.map((point) => formatUsageDateLabel(point.date));
  const totals = overview.summary.tokens;
  const series = [
    {
      name: `输入 ${formatCompactToken(totals.input)}`,
      values: overview.trend.map((point) => point.tokens.input),
    },
    {
      name: `输出 ${formatCompactToken(totals.output)}`,
      values: overview.trend.map((point) => point.tokens.output),
    },
    {
      name: `缓存写入 ${formatCompactToken(totals.cacheWrite)}`,
      values: overview.trend.map((point) => point.tokens.cacheWrite),
    },
    {
      name: `缓存读取 ${formatCompactToken(totals.cacheRead)}`,
      values: overview.trend.map((point) => point.tokens.cacheRead),
    },
  ];
  return (
    <Card className="min-w-0 gap-3 py-4">
      <CardHeader className="px-5">
        <CardTitle>Token 使用趋势</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 px-5 [&>div]:h-48">
        {overview.trend.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">所选日期没有用量</p>
        ) : (
          <LineChart
            labels={labels}
            series={series}
            ariaLabel="组织用量：输入、输出、缓存写入、缓存读取 Token 趋势"
          />
        )}
      </CardContent>
    </Card>
  );
}
