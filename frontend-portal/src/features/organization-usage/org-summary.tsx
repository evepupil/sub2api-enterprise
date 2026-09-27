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

import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { LineChart } from '../../components/charts/line-chart';
import type { UsageOverview } from '../usage/types';
import {
  formatUsageDateLabel,
  formatUsageNumber,
  formatUsageSeconds,
  formatUsageUsd,
} from '../usage/usage-format';

interface SummaryCardProps {
  label: string;
  value: string;
  detail?: React.ReactNode;
}

function SummaryCard({ label, value, detail }: SummaryCardProps) {
  return (
    <Card className="min-w-0 gap-3">
      <CardHeader className="pb-0">
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {detail !== undefined ? (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">{detail}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * 四张摘要卡：请求、总 Token（四类分项）、实际消费 USD、平均耗时。
 * 统计对象（全组织或选定成员）由父组件在筛选区说明，卡片本身不重复标注。
 */
export function OrganizationSummaryCards({ overview }: { overview: UsageOverview }) {
  const summary = overview.summary;
  return (
    <div
      className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4"
      role="group"
      aria-label="组织用量摘要"
    >
      <SummaryCard label="总请求" value={formatUsageNumber(summary.requests)} />
      <SummaryCard
        label="总 Token"
        value={formatUsageNumber(summary.tokens.total)}
        detail={
          <>
            <p className="flex justify-between gap-3">
              <span>输入</span>
              <span className="tabular-nums">{formatUsageNumber(summary.tokens.input)}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span>输出</span>
              <span className="tabular-nums">{formatUsageNumber(summary.tokens.output)}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span>缓存写入</span>
              <span className="tabular-nums">{formatUsageNumber(summary.tokens.cacheWrite)}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span>缓存读取</span>
              <span className="tabular-nums">{formatUsageNumber(summary.tokens.cacheRead)}</span>
            </p>
          </>
        }
      />
      <SummaryCard label="实际消费（USD）" value={formatUsageUsd(summary.actualCost)} />
      <SummaryCard label="平均耗时" value={formatUsageSeconds(summary.averageDurationMs)} />
    </div>
  );
}

/** 概览加载占位：与摘要卡同布局，避免内容跳动。 */
export function OrganizationSummarySkeleton() {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="gap-4">
          <CardContent className="space-y-4 pt-6">
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
  const series = [
    { name: '输入', values: overview.trend.map((point) => point.tokens.input) },
    { name: '输出', values: overview.trend.map((point) => point.tokens.output) },
    { name: '缓存写入', values: overview.trend.map((point) => point.tokens.cacheWrite) },
    { name: '缓存读取', values: overview.trend.map((point) => point.tokens.cacheRead) },
  ];
  return (
    <Card className="min-w-0 gap-4">
      <CardHeader>
        <CardTitle>Token 使用趋势</CardTitle>
      </CardHeader>
      <CardContent>
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
