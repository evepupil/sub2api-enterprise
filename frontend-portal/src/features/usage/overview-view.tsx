'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { DateRangeControl } from '../../components/console/date-range-control';
import { PageHeader } from '../../components/layout/page-header';
import { LineChart } from '../../components/charts/line-chart';
import { useAuth } from '../auth/auth-provider';
import { usePortalQuery } from '../console/use-portal-query';
import { fetchCurrentFunds, fetchUsageOverview } from './api';
import { BreakdownCard } from './breakdown-card';
import type { CurrentFunds, DateRange, TrendGranularity, UsageOverview } from './types';
import {
  formatQuotaAmount,
  formatUsageDateLabel,
  formatUsageNumber,
  formatUsageSeconds,
  formatUsageUsd,
} from './usage-format';
import { DEFAULT_TIME_ZONE, getPresetRange } from '../../lib/time/date-range';

function initialRange(): DateRange {
  return getPresetRange('last7', new Date(), DEFAULT_TIME_ZONE);
}

function FundsAction({ funds, loading }: { funds: CurrentFunds | undefined; loading: boolean }) {
  if (loading || funds === undefined) {
    return <Skeleton className="h-10 w-36" />;
  }
  if (funds.kind === 'quota') {
    return (
      <div className="min-w-32 text-right">
        <p className="text-xs text-muted-foreground">可用配额</p>
        <p className="font-semibold tabular-nums">{formatQuotaAmount(funds.amount)}</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-xs text-muted-foreground">当前余额（USD）</p>
        <p className="font-semibold tabular-nums">{formatUsageUsd(funds.amount)}</p>
        <p className="text-xs text-muted-foreground">冻结 {formatUsageUsd(funds.frozen)}</p>
      </div>
      <Button asChild size="sm">
        <Link href="/console/billing">充值</Link>
      </Button>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
}) {
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

function SummaryCards({ overview }: { overview: UsageOverview }) {
  const summary = overview.summary;
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
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

function SummarySkeleton() {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
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

function TrendCard({ overview }: { overview: UsageOverview }) {
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
            ariaLabel="输入、输出、缓存写入、缓存读取 Token 趋势"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewView() {
  const { status, user } = useAuth();
  const [range, setRange] = useState<DateRange>(initialRange);
  const [granularity, setGranularity] = useState<TrendGranularity>('day');

  const overview = usePortalQuery(
    ['usage', 'overview', range.start, range.end, range.timeZone, granularity],
    (request, signal) => fetchUsageOverview(request, range, granularity, signal),
  );
  const funds = usePortalQuery(
    ['usage', 'funds'],
    (request, signal) =>
      user === null
        ? Promise.reject(new Error('当前账号资料未就绪'))
        : fetchCurrentFunds(request, user, signal),
    { enabled: user !== null },
  );

  const overviewError = overview.isError ? '用量概览暂时无法加载' : null;
  const fundsError = funds.isError ? '当前余额暂时无法加载' : null;
  const fundsAction = useMemo(
    () => (
      <FundsAction funds={funds.data} loading={funds.isLoading || status !== 'authenticated'} />
    ),
    [funds.data, funds.isLoading, status],
  );

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="概览" actions={fundsAction} />

      {fundsError !== null ? (
        <Alert
          variant="destructive"
          title={fundsError}
          action={
            <Button onClick={() => void funds.refetch()} size="sm">
              重试
            </Button>
          }
        />
      ) : null}

      <Card className="min-w-0 gap-4">
        <CardHeader>
          <CardTitle>统计范围</CardTitle>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <DateRangeControl value={range} onChange={setRange} className="min-w-0 md:min-w-72" />
          <div className="flex items-center gap-3">
            <label htmlFor="overview-granularity" className="text-sm text-muted-foreground">
              趋势粒度
            </label>
            <Select
              value={granularity}
              onValueChange={(value) => {
                if (value === 'day' || value === 'hour') setGranularity(value);
              }}
            >
              <SelectTrigger id="overview-granularity" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">按天</SelectItem>
                <SelectItem value="hour">按小时</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {overviewError !== null ? (
        <Alert
          variant="destructive"
          title={overviewError}
          action={
            <Button onClick={() => void overview.refetch()} size="sm">
              重试
            </Button>
          }
        />
      ) : overview.isLoading || overview.data === undefined ? (
        <SummarySkeleton />
      ) : (
        <SummaryCards overview={overview.data} />
      )}

      {overview.data !== undefined && !overviewError ? (
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <BreakdownCard title="模型分布" rows={overview.data.models} />
          <BreakdownCard title="分组分布" rows={overview.data.groups} />
          <BreakdownCard title="接口分布" rows={overview.data.endpoints} />
          <TrendCard overview={overview.data} />
        </div>
      ) : null}
    </div>
  );
}
