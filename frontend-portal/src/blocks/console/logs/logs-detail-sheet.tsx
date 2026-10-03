'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ProviderLogo } from '@/components/catalog/provider-logo';
import { CopyButton } from '@/components/console/copy-button';
import { Sheet } from '@/components/console/dialog';
import { Badge } from '@/components/ui/badge';
import type { AppLocale } from '@/i18n/routing';
import { getEdition, getModel } from '@/lib/catalog';
import {
  curlFor,
  formatDateTime,
  formatDuration,
  formatInteger,
  formatUsd,
  getKey,
  type RequestLog,
} from '@/lib/console';
import { cn } from '@/lib/utils';

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

function LogDetailBody({ log }: { log: RequestLog }) {
  const t = useTranslations('consoleLogs');
  const locale = useLocale() as AppLocale;

  const model = getModel(log.modelId);
  const curl = curlFor(log);
  const succeeded = log.status === 'success';
  const errorName = log.errorCode ? t(`errors.${log.errorCode}`) : null;

  return (
    <div className="space-y-6 px-5 py-4">
      <dl>
        <DetailRow label={t('detail.time')}>
          <span className="tabular-nums">{formatDateTime(log.ts)}</span>
        </DetailRow>
        <DetailRow label={t('detail.requestId')}>
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono">{log.id}</span>
            {/* 按钮比一行字高，用负的上下外边距把行高压回去 */}
            <CopyButton name="log-id" value={log.id} label={t('menu.copyId')} className="-my-1.5" />
          </div>
        </DetailRow>
        <DetailRow label={t('detail.key')}>{getKey(log.keyId).name}</DetailRow>
        <DetailRow label={t('detail.group')}>{getEdition(log.group).name[locale]}</DetailRow>
        <DetailRow label={t('detail.model')}>
          <span className="inline-flex items-center gap-2">
            <ProviderLogo provider={model.provider} size={16} />
            <span className="font-mono">{log.modelId}</span>
          </span>
        </DetailRow>
        <DetailRow label={t('detail.type')}>
          {log.type === 'image' ? t('filters.image') : t('filters.text')}
        </DetailRow>
        <DetailRow label={t('detail.stream')}>
          {log.stream ? t('detail.yes') : t('detail.no')}
        </DetailRow>
        <DetailRow label={t('detail.status')}>
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {succeeded ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-success-graphic" />
                {t('filters.success')}
              </span>
            ) : (
              <Badge tone="danger">{t('filters.error')}</Badge>
            )}
            <span className="tabular-nums text-muted-foreground">{log.httpStatus}</span>
            {errorName ? <span className="text-muted-foreground">{errorName}</span> : null}
          </span>
        </DetailRow>
        <DetailRow label={t('detail.finish')}>{t(`finish.${log.finishReason}`)}</DetailRow>
        <DetailRow label={t('detail.inputTokens')}>
          <span className="tabular-nums">{formatInteger(log.inputTokens)}</span>
        </DetailRow>
        <DetailRow label={t('detail.cacheTokens')}>
          <span className="tabular-nums">{formatInteger(log.cacheTokens)}</span>
        </DetailRow>
        <DetailRow label={t('detail.outputTokens')}>
          <span className="tabular-nums">{formatInteger(log.outputTokens)}</span>
        </DetailRow>
        {log.type === 'image' ? (
          <DetailRow label={t('detail.images')}>
            <span className="tabular-nums">{t('table.images', { count: log.images })}</span>
          </DetailRow>
        ) : null}
        <DetailRow label={t('detail.cost')}>
          <span className="tabular-nums">{formatUsd(log.costUsd)}</span>
        </DetailRow>
        <DetailRow label={t('detail.duration')}>
          <span className="tabular-nums">{formatDuration(log.durationMs)}</span>
        </DetailRow>
        <DetailRow label={t('detail.ttft')}>
          <span className="tabular-nums">
            {log.ttftMs === null ? NONE : formatDuration(log.ttftMs)}
          </span>
        </DetailRow>
        <DetailRow label={t('detail.client')} mono>
          {log.client}
        </DetailRow>
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
 * 请求详情抽屉：标题是请求 ID，正文是这条请求的全部字段和一条可以直接复制的 curl 示例。
 * log 为空表示抽屉关闭；点遮罩、按 Esc、点关闭按钮都会通知上层清空。
 */
export function LogsDetailSheet({ log, onClose }: { log: RequestLog | null; onClose: () => void }) {
  return (
    <Sheet
      id="log-detail"
      open={log !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={log ? <span className="break-all font-mono text-sm">{log.id}</span> : null}
    >
      {log ? <LogDetailBody log={log} /> : null}
    </Sheet>
  );
}
