'use client';

import { ProviderLogo } from '@/components/catalog/provider-logo';
import { Td, Tr } from '@/components/console/data-table';
import { formatDateTime } from '@/lib/console';
import type { LogRow } from '@/lib/console/live/logs-types';
import { catalogEntry, inferProvider } from '@/lib/console/live/models-view';

import { DurationCell, FastBadge, IpCell, KeyCell, ReasoningCell, TokensCell } from './logs-cells';
import type { LogColumn } from './logs-columns';
import { CostCell } from './logs-cost';
import { LogsRowMenu } from './logs-row-menu';
import type { OpenLogDetail } from './logs-types';

/** 模型格：厂商标志 + 调用名（点开详情）+ 开了 Fast 的标签 */
function ModelCell({ log, onOpenDetail }: { log: LogRow; onOpenDetail: OpenLogDetail }) {
  const provider = catalogEntry(log.model)?.provider ?? inferProvider(log.model);
  return (
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
      <FastBadge serviceTier={log.serviceTier} />
    </div>
  );
}

/**
 * 日志表的一行（一次计费成功的调用），只画「列设置」里勾上的列，顺序同表头。
 * 时间拆成日期和时分秒两行、固定在左侧；模型名是打开详情的入口；费用后面的「i」悬停看费用明细；
 * 最后一格（更多操作）固定在右侧，横向滚动时也能点。
 */
export function LogsTableRow({
  log,
  columns,
  onOpenDetail,
}: {
  log: LogRow;
  columns: readonly LogColumn[];
  onOpenDetail: OpenLogDetail;
}) {
  const [date = '', time = ''] = formatDateTime(Date.parse(log.createdAt)).split(' ');

  const cell = (column: LogColumn) => {
    switch (column) {
      case 'time':
        return (
          <Td key={column} sticky="left" className="whitespace-nowrap tabular-nums max-sm:static">
            <div className="text-foreground">{date}</div>
            <div className="text-xs text-subtle-foreground">{time}</div>
          </Td>
        );
      case 'key':
        return (
          <Td key={column}>
            <KeyCell row={log} />
          </Td>
        );
      case 'model':
        return (
          <Td key={column}>
            <ModelCell log={log} onOpenDetail={onOpenDetail} />
          </Td>
        );
      case 'reasoning':
        return (
          <Td key={column}>
            <ReasoningCell row={log} />
          </Td>
        );
      case 'tokens':
        return (
          <Td key={column}>
            <TokensCell row={log} />
          </Td>
        );
      case 'cost':
        return (
          <Td key={column} align="right">
            <CostCell row={log} />
          </Td>
        );
      case 'duration':
        return (
          <Td key={column}>
            <DurationCell row={log} />
          </Td>
        );
      case 'ip':
        return (
          <Td key={column}>
            <IpCell row={log} />
          </Td>
        );
    }
  };

  return (
    <Tr data-log-row={log.id}>
      {columns.map(cell)}
      <Td sticky="right" align="center">
        <LogsRowMenu log={log} onOpenDetail={onOpenDetail} />
      </Td>
    </Tr>
  );
}
