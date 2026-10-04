'use client';

import { ScrollText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/console/button';
import { Table, TableShell, Th } from '@/components/console/data-table';
import { EmptyState } from '@/components/console/empty-state';
import { Pagination } from '@/components/console/pagination';
import type { LogsPageData } from '@/lib/console/live/logs-types';

import { LogsTableRow } from './logs-table-row';
import type { OpenLogDetail } from './logs-types';

/** 表格最窄的宽度：再窄就在外框里横向滚动，不让页面横向溢出 */
const TABLE_MIN_WIDTH = 1080;

/**
 * 调用记录表：表头、当前页的行、底部分页（分页由后端做，这里只上报翻页和每页条数）。
 * 没有符合条件的调用时，整个表体换成空状态，并给一个清除筛选的出口。
 */
export function LogsTable({
  data,
  onPageChange,
  onPageSizeChange,
  onOpenDetail,
  onClear,
}: {
  data: LogsPageData;
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
      <Table minWidth={TABLE_MIN_WIDTH} aria-label={t('meta.title')}>
        <thead>
          <tr>
            <Th sticky="left" className="max-sm:static">
              {t('table.time')}
              <span className="ml-1.5 font-normal">{t('table.tz')}</span>
            </Th>
            <Th>{t('table.key')}</Th>
            <Th>{t('table.model')}</Th>
            <Th>{t('table.tokens')}</Th>
            <Th align="right">{t('table.cost')}</Th>
            <Th>{t('table.duration')}</Th>
            <Th>{t('table.billing')}</Th>
            <Th sticky="right" align="center">
              {tc('table.actions')}
            </Th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((log) => (
            <LogsTableRow key={log.id} log={log} onOpenDetail={onOpenDetail} />
          ))}
        </tbody>
      </Table>
    </TableShell>
  );
}
