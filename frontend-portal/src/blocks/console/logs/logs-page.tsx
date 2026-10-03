'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ConsolePage } from '@/components/console/console-page';
import { usePagination } from '@/components/console/pagination';
import { RefreshButton } from '@/components/console/refresh-button';
import {
  DEFAULT_RANGE,
  filterLogs,
  REQUEST_LOGS,
  type LogFilter,
  type RequestLog,
} from '@/lib/console';

import { LogsDetailSheet } from './logs-detail-sheet';
import { LogsFilters } from './logs-filters';
import { LogsTable } from './logs-table';
import type { OpenLogDetail } from './logs-types';

/** 默认筛选：最近 30 天、其余条件都不限 */
const DEFAULT_FILTER: LogFilter = {
  range: DEFAULT_RANGE,
  keyId: 'all',
  modelId: 'all',
  status: 'all',
  type: 'all',
  stream: 'all',
  query: '',
};

/** 筛选条件的指纹：用来判断「是否偏离默认值」，也是分页回到第 1 页的信号 */
const DEFAULT_FILTER_KEY = JSON.stringify(DEFAULT_FILTER);

/**
 * 请求日志页：筛选栏决定看哪些请求，表格分页展示，点模型名或「查看详情」从右侧抽屉看单条请求。
 * 筛选、分页、抽屉三块状态都在这里，子组件只负责画和上报操作。
 */
export function LogsPage() {
  const t = useTranslations('consoleLogs');
  const [filter, setFilter] = useState<LogFilter>(DEFAULT_FILTER);
  const [detail, setDetail] = useState<RequestLog | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const rows = useMemo(() => filterLogs(REQUEST_LOGS, filter), [filter]);
  const filterKey = JSON.stringify(filter);
  const dirty = filterKey !== DEFAULT_FILTER_KEY;
  const pager = usePagination(rows, filterKey);

  const clearFilters = () => setFilter(DEFAULT_FILTER);

  const openDetail: OpenLogDetail = (log, button) => {
    opener.current = button;
    setDetail(log);
  };

  // 详情抽屉没有自带的触发按钮，关闭时浏览器会把焦点丢到页面最上面，键盘用户就找不到刚才那一行了。
  // 所以等抽屉卸载之后，把焦点还给打开它的那个按钮。
  useEffect(() => {
    if (detail !== null) return;
    opener.current?.focus();
    opener.current = null;
  }, [detail]);

  return (
    <ConsolePage id="logs" title={t('meta.title')} actions={<RefreshButton />}>
      <LogsFilters
        filter={filter}
        onChange={setFilter}
        rows={rows}
        dirty={dirty}
        onClear={clearFilters}
      />
      <LogsTable pager={pager} onOpenDetail={openDetail} onClear={clearFilters} />
      <LogsDetailSheet log={detail} onClose={() => setDetail(null)} />
    </ConsolePage>
  );
}
