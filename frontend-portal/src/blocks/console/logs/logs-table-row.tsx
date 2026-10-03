'use client';

import { ArrowDown, ArrowUp, Database, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { ProviderLogo } from '@/components/catalog/provider-logo';
import { Td, Tr } from '@/components/console/data-table';
import { Badge } from '@/components/ui/badge';
import type { AppLocale } from '@/i18n/routing';
import { getEdition, getModel } from '@/lib/catalog';
import {
  formatCompact,
  formatDateTime,
  formatDuration,
  formatUsd,
  type RequestLog,
} from '@/lib/console';

import { LogsRowMenu } from './logs-row-menu';
import type { OpenLogDetail } from './logs-types';

/** Token 一格里的一小段：图标 + 数字。图标只是装饰，含义靠悬停提示和读屏文字 */
function TokenPart({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <span title={label} className="inline-flex items-center gap-1">
      <Icon aria-hidden className="size-3.5 text-subtle-foreground" />
      <span className="sr-only">{label}</span>
      {formatCompact(value)}
    </span>
  );
}

/**
 * 请求表的一行。时间拆成日期和时分秒两行；模型调用名是打开详情的入口；
 * 失败请求在状态格里直接写错误名；最后一格固定在右侧，横向滚动时也能点。
 */
export function LogsTableRow({
  log,
  onOpenDetail,
}: {
  log: RequestLog;
  onOpenDetail: OpenLogDetail;
}) {
  const t = useTranslations('consoleLogs');
  const locale = useLocale() as AppLocale;

  const [date = '', time = ''] = formatDateTime(log.ts).split(' ');

  return (
    <Tr data-log-row={log.id}>
      <Td className="whitespace-nowrap tabular-nums">
        <div className="text-foreground">{date}</div>
        <div className="text-xs text-subtle-foreground">{time}</div>
      </Td>
      <Td>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <ProviderLogo provider={getModel(log.modelId).provider} size={16} />
          <button
            type="button"
            data-log-open={log.id}
            onClick={(event) => onOpenDetail(log, event.currentTarget)}
            className="font-mono text-sm underline decoration-dotted underline-offset-4 transition-colors hover:decoration-solid"
          >
            {log.modelId}
          </button>
        </div>
      </Td>
      <Td className="whitespace-nowrap tabular-nums">
        {log.type === 'image' ? (
          t('table.images', { count: log.images })
        ) : (
          <span className="inline-flex items-center gap-3">
            <TokenPart icon={ArrowDown} label={t('table.input')} value={log.inputTokens} />
            <TokenPart icon={ArrowUp} label={t('table.output')} value={log.outputTokens} />
            {log.cacheTokens > 0 ? (
              <TokenPart icon={Database} label={t('table.cache')} value={log.cacheTokens} />
            ) : null}
          </span>
        )}
      </Td>
      <Td align="right" className="whitespace-nowrap tabular-nums">
        {formatUsd(log.costUsd)}
      </Td>
      <Td className="whitespace-nowrap tabular-nums">
        {formatDuration(log.durationMs)}
        {log.ttftMs !== null ? (
          <span className="ml-1.5 text-xs text-subtle-foreground">
            {t('table.ttft', { value: formatDuration(log.ttftMs) })}
          </span>
        ) : null}
      </Td>
      <Td>
        <Badge tone="outline">{getEdition(log.group).name[locale]}</Badge>
      </Td>
      <Td>
        {log.status === 'success' ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden className="size-2 rounded-full bg-success-graphic" />
            {t('table.success')}
          </span>
        ) : (
          <Badge tone="danger">
            {log.errorCode ? t(`errors.${log.errorCode}`) : t('filters.error')}
          </Badge>
        )}
      </Td>
      <Td sticky="right" align="center">
        <LogsRowMenu log={log} onOpenDetail={onOpenDetail} />
      </Td>
    </Tr>
  );
}
