'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ProviderLogo } from '@/components/catalog/provider-logo';
import { CopyButton } from '@/components/console/copy-button';
import { Sheet } from '@/components/console/dialog';
import { GroupWithRate } from '@/components/console/group-rate';
import { formatDateTime, formatDuration, formatInteger, formatUsd } from '@/lib/console';
import type { LogRow } from '@/lib/console/live/logs-types';
import { curlExample } from '@/lib/console/live/logs-view';
import { catalogEntry, inferProvider } from '@/lib/console/live/models-view';
import { cn } from '@/lib/utils';

import { FastBadge } from './logs-cells';

/** 没有值时的占位（例如非流式请求没有首字耗时） */
const NONE = '—';

/** 定义列表的一行：左边标签，右边值；值很长（请求 ID、调用方）时在任意位置断行，不撑破抽屉 */
function DetailRow({
  label,
  mono = false,
  children,
}: {
  label: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-subtle-foreground">{label}</dt>
      <dd className={cn('break-all text-foreground', mono && 'font-mono')}>{children}</dd>
    </div>
  );
}

function LogDetailBody({ log }: { log: LogRow }) {
  const t = useTranslations('consoleLogs');
  const provider = catalogEntry(log.model)?.provider ?? inferProvider(log.model);
  const curl = curlExample(log);
  const number = (value: number) => <span className="tabular-nums">{formatInteger(value)}</span>;

  return (
    <div className="space-y-6 px-5 py-4">
      <dl>
        <DetailRow label={t('detail.time')}>
          <span className="tabular-nums">{formatDateTime(Date.parse(log.createdAt))}</span>
        </DetailRow>
        {log.requestId ? (
          <DetailRow label={t('detail.requestId')}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono">{log.requestId}</span>
              {/* 按钮比一行字高，用负的上下外边距把行高压回去 */}
              <CopyButton
                name="log-id"
                value={log.requestId}
                label={t('menu.copyId')}
                className="-my-1.5"
              />
            </div>
          </DetailRow>
        ) : null}
        <DetailRow label={t('detail.key')}>{log.key.name}</DetailRow>
        <DetailRow label={t('detail.group')}>
          <GroupWithRate name={log.group?.name ?? t('table.noGroup')} rate={log.rate} />
        </DetailRow>
        <DetailRow label={t('detail.model')}>
          <span className="inline-flex items-center gap-2">
            {provider ? <ProviderLogo provider={provider} size={16} /> : null}
            <span className="font-mono">{log.model}</span>
            <FastBadge serviceTier={log.serviceTier} />
          </span>
        </DetailRow>
        {log.reasoningEffort ? (
          <DetailRow label={t('detail.reasoning')}>{log.reasoningEffort}</DetailRow>
        ) : null}
        {log.endpoint ? (
          <DetailRow label={t('detail.endpoint')} mono>
            {log.endpoint}
          </DetailRow>
        ) : null}
        <DetailRow label={t('detail.stream')}>
          {log.stream ? t('detail.yes') : t('detail.no')}
        </DetailRow>
        <DetailRow label={t('detail.inputTokens')}>{number(log.tokens.input)}</DetailRow>
        <DetailRow label={t('detail.outputTokens')}>{number(log.tokens.output)}</DetailRow>
        <DetailRow label={t('detail.cacheRead')}>{number(log.tokens.cacheRead)}</DetailRow>
        <DetailRow label={t('detail.cacheWrite')}>{number(log.tokens.cacheWrite)}</DetailRow>
        {log.images.count > 0 ? (
          <DetailRow label={t('detail.images')}>
            {log.images.size
              ? t('detail.imagesWithSize', { count: log.images.count, size: log.images.size })
              : t('detail.imageCount', { count: log.images.count })}
          </DetailRow>
        ) : null}
        <DetailRow label={t('detail.officialCost')}>
          <div className="tabular-nums">
            <div>{formatUsd(log.costs.total)}</div>
            <div className="text-xs text-subtle-foreground">
              {t('detail.officialBreakdown', {
                input: formatUsd(log.costs.input),
                output: formatUsd(log.costs.output),
                cacheRead: formatUsd(log.costs.cacheRead),
                cacheWrite: formatUsd(log.costs.cacheWrite),
              })}
            </div>
          </div>
        </DetailRow>
        <DetailRow label={t('detail.actualCost')}>
          <span className="font-medium tabular-nums">{formatUsd(log.actualCost)}</span>
        </DetailRow>
        {log.longContext ? (
          <DetailRow label={t('detail.longContext')}>{t('detail.yes')}</DetailRow>
        ) : null}
        <DetailRow label={t('detail.duration')}>
          <span className="tabular-nums">
            {log.durationMs === null ? NONE : formatDuration(log.durationMs)}
          </span>
        </DetailRow>
        <DetailRow label={t('detail.firstToken')}>
          <span className="tabular-nums">
            {log.firstTokenMs === null ? NONE : formatDuration(log.firstTokenMs)}
          </span>
        </DetailRow>
        {log.userAgent ? (
          <DetailRow label={t('detail.client')} mono>
            {log.userAgent}
          </DetailRow>
        ) : null}
        {log.ip ? (
          <DetailRow label={t('detail.ip')} mono>
            {log.ip}
          </DetailRow>
        ) : null}
      </dl>

      <section>
        <h3 className="text-sm font-semibold text-foreground">{t('detail.example')}</h3>
        <div className="relative mt-2">
          {/* pr-12：给右上角的复制按钮留出位置，第一行不会被它盖住 */}
          <pre className="overflow-x-auto rounded-xl bg-muted p-4 pr-12 font-mono text-xs leading-5">
            {curl}
          </pre>
          <CopyButton
            name="log-curl"
            value={curl}
            label={t('menu.copyCurl')}
            className="absolute right-2 top-2 hover:bg-card"
          />
        </div>
      </section>
    </div>
  );
}

/**
 * 调用详情抽屉：标题是请求 ID（没有时写模型名），正文是这条记录的全部字段和一条可复制的示意请求。
 * log 为空表示抽屉关闭；点遮罩、按 Esc、点关闭按钮都会通知上层清空。
 */
export function LogsDetailSheet({ log, onClose }: { log: LogRow | null; onClose: () => void }) {
  return (
    <Sheet
      id="log-detail"
      open={log !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={
        log ? (
          <span className="break-all font-mono text-sm">{log.requestId || log.model}</span>
        ) : null
      }
    >
      {log ? <LogDetailBody log={log} /> : null}
    </Sheet>
  );
}
