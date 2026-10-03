'use client';

import { ScrollText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Table, TableShell, Th } from '@/components/console/data-table';
import { EmptyState } from '@/components/console/empty-state';
import { Pagination, type usePagination } from '@/components/console/pagination';
import { Button } from '@/components/console/button';
import type { RequestLog } from '@/lib/console';

import { LogsTableRow } from './logs-table-row';
import type { OpenLogDetail } from './logs-types';

/** 表格最窄的宽度：再窄就在外框里横向滚动，不让页面横向溢出 */
const TABLE_MIN_WIDTH = 1040;

/**
 * 请求表：表头、当前页的行、底部分页。
 * 没有符合条件的请求时，整个表体换成空状态（不显示表头和分页），并给一个清除筛选的出口。
 */
export function LogsTable({
  pager,
  onOpenDetail,
  onClear,
}: {
  pager: ReturnType<typeof usePagination<RequestLog>>;
  onOpenDetail: OpenLogDetail;
  onClear: () => void;
}) {
  const t = useTranslations('consoleLogs');
  const tc = useTranslations('console');

  if (pager.total === 0) {
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
          page={pager.page}
          pages={pager.pages}
          total={pager.total}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
        />
      }
    >
      <Table minWidth={TABLE_MIN_WIDTH} aria-label={t('meta.title')}>
        <thead>
          <tr>
            <Th>
              {t('table.time')}
              <span className="ml-1.5 font-normal">{t('table.tz')}</span>
            </Th>
            <Th>{t('table.model')}</Th>
            <Th>{t('table.tokens')}</Th>
            <Th align="right">{t('table.cost')}</Th>
            <Th>{t('table.duration')}</Th>
            <Th>{t('table.group')}</Th>
            <Th>{t('table.status')}</Th>
            <Th sticky="right" align="center">
              {tc('table.actions')}
            </Th>
          </tr>
        </thead>
        <tbody>
          {pager.items.map((log) => (
            <LogsTableRow key={log.id} log={log} onOpenDetail={onOpenDetail} />
          ))}
        </tbody>
      </Table>
    </TableShell>
  );
}
