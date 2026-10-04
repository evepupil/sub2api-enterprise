'use client';

import { ScrollText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/console/button';
import { Table, TableShell, Th } from '@/components/console/data-table';
import { EmptyState } from '@/components/console/empty-state';
import { Pagination } from '@/components/console/pagination';
import type { LogsPageData } from '@/lib/console/live/logs-types';

import { logsTableMinWidth, type LogColumn } from './logs-columns';
import { LogsTableRow } from './logs-table-row';
import type { OpenLogDetail } from './logs-types';

/**
 * 调用记录表：表头、当前页的行、底部分页（分页由后端做，这里只上报翻页和每页条数）。
 * 只画「列设置」里勾上的列，最窄宽度跟着列数变。
 * 没有符合条件的调用时，整个表体换成空状态，并给一个清除筛选的出口。
 */
export function LogsTable({
  data,
  columns,
  onPageChange,
  onPageSizeChange,
  onOpenDetail,
  onClear,
}: {
  data: LogsPageData;
  /** 要显示的列，按表格顺序 */
  columns: readonly LogColumn[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenDetail: OpenLogDetail;
  onClear: () => void;
}) {
  const t = useTranslations('consoleLogs');
  const tc = useTranslations('console');

  if (data.total === 0) {
    return (
      <TableShell id="logs">
        <EmptyState
          id="logs"
          icon={ScrollText}
          title={t('empty')}
          bordered={false}
          action={
            <Button variant="secondary" data-empty-clear onClick={onClear}>
              {t('filters.clear')}
            </Button>
          }
        />
      </TableShell>
    );
  }

  const header = (column: LogColumn) => {
    switch (column) {
      case 'time':
        return (
          <Th key={column} sticky="left" className="max-sm:static">
            {t('table.time')}
            <span className="ml-1.5 font-normal">{t('table.tz')}</span>
          </Th>
        );
      case 'cost':
        return (
          <Th key={column} align="right">
            {t('table.cost')}
          </Th>
        );
      default:
        return <Th key={column}>{t(`table.${column}`)}</Th>;
    }
  };

  return (
    <TableShell
      id="logs"
      footer={
        <Pagination
          page={data.page}
          pages={Math.max(1, Math.ceil(data.total / data.pageSize))}
          total={data.total}
          pageSize={data.pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      }
    >
      <Table minWidth={logsTableMinWidth(columns)} aria-label={t('meta.title')}>
        <thead>
          <tr>
            {columns.map(header)}
            <Th sticky="right" align="center">
              {tc('table.actions')}
            </Th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((log) => (
            <LogsTableRow key={log.id} log={log} columns={columns} onOpenDetail={onOpenDetail} />
          ))}
        </tbody>
      </Table>
    </TableShell>
  );
}
