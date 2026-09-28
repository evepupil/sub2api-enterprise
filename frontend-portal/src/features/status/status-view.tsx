'use client';

import { Activity, CircleAlert, CircleCheck, Clock3, RefreshCw } from 'lucide-react';

import { SectionHeading } from '../../components/marketing/section-heading';
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

function StatusLevelIcon({ level }: { level: StatusLevel }) {
  const Icon = level === 'operational' ? CircleCheck : level === 'unknown' ? Clock3 : CircleAlert;
  return <Icon aria-hidden="true" className="size-5" />;
}

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
    <Card className="status-component-card gap-5 rounded-card p-5 shadow-none">
      <div className="status-component-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="status-component-name min-w-0 break-words">{component.name}</h2>
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

      <section className="status-history" aria-label="近期可用性">
        <h3>近期可用性</h3>
        {component.history.length === 0 ? (
          <p className="status-history-empty">暂无探测记录</p>
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
    <div className="public-page public-page-status space-y-8">
      <section
        className="public-page-hero"
        data-slot="marketing-hero"
        aria-labelledby="status-title"
      >
        <div className="public-page-hero-row">
          <div className="public-page-hero-copy">
            <p className="public-page-eyebrow public-page-eyebrow-with-icon">
              <Activity aria-hidden="true" /> 服务状态 / STATUS
            </p>
            <h1 id="status-title" className="public-page-title">
              每一次连接，都有迹可循。
            </h1>
            <p className="public-page-description">
              查看实际探测得到的可用率、最近响应耗时和历史记录，遇到问题时沿着同一条信息找到答案。
            </p>
          </div>
          {result.kind === 'ready' ? (
            <div className="status-page-actions">
              <time dateTime={result.data.updatedAt}>
                更新于 {formatShanghaiDateTime(result.data.updatedAt)}
              </time>
              {refreshButton}
            </div>
          ) : null}
        </div>
      </section>

      {result.kind === 'disabled' ? (
        <div className="public-page-state">
          <EmptyState title="服务状态尚未公开" />
        </div>
      ) : result.kind === 'authentication-required' ? (
        <div className="public-page-state">
          <EmptyState title="暂时无法查看服务状态" description="当前账号没有查看状态数据的权限。" />
        </div>
      ) : result.kind === 'unavailable' ? (
        <div className="public-page-state">
          <Alert
            variant="destructive"
            title="服务状态暂时无法加载"
            action={
              <Button variant="outline" onClick={() => window.location.reload()}>
                重试
              </Button>
            }
          />
        </div>
      ) : result.kind === 'ready' ? (
        <>
          <dl className="status-summary-grid" aria-label="服务状态摘要">
            <div className="status-summary-card" data-level={result.data.level}>
              <div className="status-summary-icon" aria-hidden="true">
                <StatusLevelIcon level={result.data.level} />
              </div>
              <div>
                <dt>总体状态</dt>
                <dd>
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
            </div>
            <div className="status-summary-card">
              <div className="status-summary-icon" aria-hidden="true">
                <CircleCheck className="size-5" />
              </div>
              <div>
                <dt>近7天可用率</dt>
                <dd className="tabular-nums">{formatAvailability(result.data.availability)}</dd>
              </div>
            </div>
            <div className="status-summary-card">
              <div className="status-summary-icon" aria-hidden="true">
                <Clock3 className="size-5" />
              </div>
              <div>
                <dt>监测项目数</dt>
                <dd className="tabular-nums">{result.data.components.length}</dd>
              </div>
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

          <section className="status-guidance" aria-labelledby="status-guidance-title">
            <SectionHeading
              eyebrow="读懂状态"
              title="三组信息，刚好够你判断下一步。"
              id="status-guidance-title"
              description="页面只展示已经探测到的事实，缺失时会明确说明记录边界。"
            />
            <div className="status-guidance-grid">
              <article>
                <h3>可用性</h3>
                <p>近七天探测结果的比例，用来观察服务是否持续可用。</p>
              </article>
              <article>
                <h3>响应耗时</h3>
                <p>每个项目最近一次响应的耗时，只代表当前值，不代替历史曲线。</p>
              </article>
              <article>
                <h3>记录范围</h3>
                <p>历史条来自实际探测记录，覆盖范围取决于探测间隔和返回数量。</p>
              </article>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
