'use client';

import { RefreshCw } from 'lucide-react';

import { PageHeader } from '../../components/layout/page-header';
import { Alert } from '../../components/ui/alert';
import { Badge, type BadgeVariant } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { StatusTimeline } from './status-timeline';
import type { PublicResult, StatusComponent, StatusData, StatusLevel } from '../public/types';

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';
const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: SHANGHAI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const availabilityFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
const secondsFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

const STATUS_LABELS: Readonly<Record<StatusLevel, string>> = {
  operational: '正常',
  degraded: '性能下降',
  outage: '不可用',
  unknown: '暂无数据',
};

const STATUS_BADGE_VARIANTS: Readonly<Record<StatusLevel, BadgeVariant>> = {
  operational: 'success',
  degraded: 'warning',
  outage: 'destructive',
  unknown: 'neutral',
};

export interface StatusViewProps {
  result: PublicResult<StatusData>;
}

function formatShanghaiDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function formatAvailability(value: number | null): string {
  return value === null ? '—' : `${availabilityFormatter.format(value)}%`;
}

function formatLatency(value: number | null): string {
  if (value === null) {
    return '—';
  }
  if (value === 0) {
    return '0 ms';
  }
  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  return `${secondsFormatter.format(value / 1000)} 秒`;
}

function StatusComponentCard({ component }: { component: StatusComponent }) {
  const firstPoint = component.history[0];
  const lastPoint = component.history.at(-1);

  return (
    <Card className="gap-5 rounded-card p-5 shadow-none">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="min-w-0 break-words text-xl font-semibold text-foreground [overflow-wrap:anywhere]">
              {component.name}
            </h2>
            <Badge
              variant={STATUS_BADGE_VARIANTS[component.level]}
              className={
                component.level === 'unknown' ? 'bg-muted text-muted-foreground' : undefined
              }
            >
              {STATUS_LABELS[component.level]}
            </Badge>
          </div>
          {component.groupName ? (
            <p className="mt-1 break-words text-sm text-muted-foreground">{component.groupName}</p>
          ) : null}
        </div>

        <dl className="grid min-w-0 grid-cols-1 gap-4 sm:w-80 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">近7天可用率</dt>
            <dd className="mt-1 break-words text-base font-medium tabular-nums text-foreground">
              {formatAvailability(component.availability)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">最近响应耗时</dt>
            <dd className="mt-1 break-words text-base font-medium tabular-nums text-foreground">
              {formatLatency(component.latencyMs)}
            </dd>
          </div>
        </dl>
      </div>

      <section className="space-y-3 border-t border-border pt-4" aria-label="近期可用性">
        <h3 className="text-sm font-medium text-foreground">近期可用性</h3>
        {component.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无探测记录</p>
        ) : (
          <>
            <StatusTimeline points={component.history} />
            {firstPoint && lastPoint ? (
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  起{' '}
                  <time dateTime={firstPoint.checkedAt}>
                    {formatShanghaiDateTime(firstPoint.checkedAt)} (Asia/Shanghai)
                  </time>
                </span>
                <span>
                  止{' '}
                  <time dateTime={lastPoint.checkedAt}>
                    {formatShanghaiDateTime(lastPoint.checkedAt)} (Asia/Shanghai)
                  </time>
                </span>
              </div>
            ) : null}
          </>
        )}
      </section>
    </Card>
  );
}

export function StatusView({ result }: StatusViewProps) {
  const refreshButton = (
    <Button
      variant="outline"
      size="icon"
      title="刷新服务状态"
      aria-label="刷新服务状态"
      onClick={() => window.location.reload()}
    >
      <RefreshCw aria-hidden="true" />
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="服务状态"
        actions={
          result.kind === 'ready' ? (
            <>
              <time dateTime={result.data.updatedAt} className="text-sm text-muted-foreground">
                更新时间：{formatShanghaiDateTime(result.data.updatedAt)} (Asia/Shanghai)
              </time>
              {refreshButton}
            </>
          ) : undefined
        }
      />

      {result.kind === 'disabled' ? (
        <EmptyState title="服务状态尚未公开" />
      ) : result.kind === 'authentication-required' ? (
        <EmptyState title="暂时无法查看服务状态" />
      ) : result.kind === 'unavailable' ? (
        <Alert
          variant="destructive"
          title="服务状态暂时无法加载"
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              重试
            </Button>
          }
        />
      ) : result.kind === 'ready' ? (
        <>
          <dl className="grid grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="py-4 sm:px-5">
              <dt className="text-sm text-muted-foreground">总体状态</dt>
              <dd className="mt-2">
                <Badge
                  variant={STATUS_BADGE_VARIANTS[result.data.level]}
                  className={
                    result.data.level === 'unknown' ? 'bg-muted text-muted-foreground' : undefined
                  }
                >
                  {STATUS_LABELS[result.data.level]}
                </Badge>
              </dd>
            </div>
            <div className="py-4 sm:px-5">
              <dt className="text-sm text-muted-foreground">近7天可用率</dt>
              <dd className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                {formatAvailability(result.data.availability)}
              </dd>
            </div>
            <div className="py-4 sm:px-5">
              <dt className="text-sm text-muted-foreground">监测项目数</dt>
              <dd className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                {result.data.components.length}
              </dd>
            </div>
          </dl>

          {result.data.components.length === 0 ? (
            <EmptyState title="暂无监测项目" />
          ) : (
            <div className="space-y-4">
              {result.data.components.map((component, index) => (
                <StatusComponentCard key={`${component.name}-${index}`} component={component} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
