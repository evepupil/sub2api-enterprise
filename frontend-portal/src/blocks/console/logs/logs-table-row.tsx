'use client';

import { ProviderLogo } from '@/components/catalog/provider-logo';
import { Td, Tr } from '@/components/console/data-table';
import { formatDateTime, formatUsd } from '@/lib/console';
import type { LogRow } from '@/lib/console/live/logs-types';
import { catalogEntry, inferProvider } from '@/lib/console/live/models-view';

import { BillingCell, DurationCell, KeyCell, TokensCell } from './logs-cells';
import { LogsRowMenu } from './logs-row-menu';
import type { OpenLogDetail } from './logs-types';

/**
 * 日志表的一行（一次计费成功的调用）。时间拆成日期和时分秒两行、固定在左侧；
 * 模型名是打开详情的入口；最后一格（更多操作）固定在右侧，横向滚动时也能点。
 */
export function LogsTableRow({ log, onOpenDetail }: { log: LogRow; onOpenDetail: OpenLogDetail }) {
  const [date = '', time = ''] = formatDateTime(Date.parse(log.createdAt)).split(' ');
  const provider = catalogEntry(log.model)?.provider ?? inferProvider(log.model);

  return (
    <Tr data-log-row={log.id}>
      <Td sticky="left" className="whitespace-nowrap tabular-nums max-sm:static">
        <div className="text-foreground">{date}</div>
        <div className="text-xs text-subtle-foreground">{time}</div>
      </Td>
      <Td>
        <KeyCell row={log} />
      </Td>
      <Td>
        <div className="flex items-center gap-2 whitespace-nowrap">
          {provider ? (
            <ProviderLogo provider={provider} size={16} />
          ) : (
            <span aria-hidden className="size-4 shrink-0 rounded-full bg-muted" />
          )}
          <button
            type="button"
            data-log-open={log.id}
            onClick={(event) => onOpenDetail(log, event.currentTarget)}
            className="font-mono text-sm underline decoration-dotted underline-offset-4 transition-colors hover:decoration-solid"
          >
            {log.model}
          </button>
        </div>
      </Td>
      <Td>
        <TokensCell row={log} />
      </Td>
      <Td align="right" className="whitespace-nowrap font-medium tabular-nums">
        {formatUsd(log.actualCost)}
      </Td>
      <Td>
        <DurationCell row={log} />
      </Td>
      <Td>
        <BillingCell row={log} />
      </Td>
      <Td sticky="right" align="center">
        <LogsRowMenu log={log} onOpenDetail={onOpenDetail} />
      </Td>
    </Tr>
  );
}
