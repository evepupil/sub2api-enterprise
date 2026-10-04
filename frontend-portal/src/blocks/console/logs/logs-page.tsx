'use client';

import { TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/console/button';
import { ConsolePage } from '@/components/console/console-page';
import { EmptyState } from '@/components/console/empty-state';
import { RefreshButton } from '@/components/console/refresh-button';
import { Skeleton } from '@/components/console/skeleton';
import { presetRange, type DateRange, type RangePreset } from '@/lib/console';
import { DEFAULT_PAGE_SIZE } from '@/lib/console/pagination';
import {
  downloadLogsCsv,
  fetchLogOptions,
  fetchLogs,
  unavailable,
  useLoadable,
} from '@/lib/console/live/logs-client';
import { useColumnPrefs } from '@/lib/console/live/column-prefs';
import type { LogFilters, LogOptions, LogRow, LogsPageData } from '@/lib/console/live/logs-types';
import { useLiveClock } from '@/lib/console/live/use-live-clock';
import { usageSince } from '@/lib/console/live/usage-view';
import { useSession } from '@/lib/session/session-provider';
import { cn } from '@/lib/utils';

import { LOG_COLUMN_PREFS } from './logs-columns';
import { LogsDetailSheet } from './logs-detail-sheet';
import { LogsFilters } from './logs-filters';
import { LogsTable } from './logs-table';
import {
  DEFAULT_SELECTION,
  isDefaultSelection,
  type LogSelection,
  type OpenLogDetail,
} from './logs-types';

const DEFAULT_PRESET: RangePreset = 'last30d';

/**
 * 日志页（接后端）：登录账号自己的计费成功的调用，从新到旧。筛选栏决定看哪些调用，
 * 表格由后端分页；点模型名或「查看详情」从右侧抽屉看单条调用。换条件时先留着旧数据（变浅），
 * 新数据到了再换；取不到时整页显示出错与重试。表格显示哪些列由「列设置」决定，存在这台浏览器里。
 */
export function LogsPage() {
  const t = useTranslations('consoleLogs');
  const locale = useLocale();
  const clock = useLiveClock();
  const { user } = useSession();

  const [selection, setSelection] = useState<LogSelection>(DEFAULT_SELECTION);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [reloadKey, setReloadKey] = useState(0);
  const [detail, setDetail] = useState<LogRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const [columns, saveColumns] = useColumnPrefs(LOG_COLUMN_PREFS);

  const today = clock?.today ?? null;
  const since = today === null ? null : usageSince(user?.createdAt ?? null, today);
  // 预设范围跟着「今天」走（跨天自动更新），自定义范围原样保留
  const range = useMemo<DateRange | null>(() => {
    if (today === null || since === null) return null;
    if (selection.range === null) return presetRange(DEFAULT_PRESET, today, since);
    return selection.range.preset
      ? presetRange(selection.range.preset, today, since)
      : selection.range;
  }, [selection.range, today, since]);

  const filters: LogFilters | null = range
    ? {
        from: range.from,
        to: range.to,
        keyId: selection.keyId,
        model: selection.model,
        type: selection.type,
        stream: selection.stream,
      }
    : null;
  const query = filters ? { ...filters, page, pageSize } : null;

  const logs = useLoadable<LogsPageData>(
    query ? `${JSON.stringify(query)}|${reloadKey}` : null,
    (signal) => (query ? fetchLogs(query, signal) : unavailable()),
  );
  const options = useLoadable<LogOptions>(
    range ? `${range.from}|${range.to}|${reloadKey}` : null,
    (signal) => (range ? fetchLogOptions(range.from, range.to, signal) : unavailable()),
  );

  // 筛选条件一变就回到第 1 页
  const changeSelection = (change: Partial<LogSelection>) => {
    setSelection((current) => ({ ...current, ...change }));
    setPage(1);
    setExportFailed(false);
  };
  const clearFilters = () => {
    setSelection(DEFAULT_SELECTION);
    setPage(1);
    setExportFailed(false);
  };
  const reload = () => setReloadKey((key) => key + 1);

  const exportCsv = async () => {
    if (!filters) return;
    setExporting(true);
    setExportFailed(false);
    const ok = await downloadLogsCsv(filters, locale);
    setExporting(false);
    setExportFailed(!ok);
  };

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

  const data = logs.data;
  const stale = data !== null && logs.loading;

  let body: React.ReactNode;
  if (logs.error) {
    body = (
      <EmptyState
        id="logs-error"
        icon={TriangleAlert}
        title={logs.error === 'too_many' ? t('error.tooMany') : t('error.unavailable')}
        action={
          <Button variant="secondary" onClick={reload} data-logs-retry>
            {t('error.retry')}
          </Button>
        }
      />
    );
  } else if (data === null) {
    body = (
      <div data-logs-loading className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  } else {
    body = (
      <div
        data-logs-content
        aria-busy={logs.loading ? 'true' : undefined}
        className={cn('transition-opacity', stale && 'opacity-60')}
      >
        <LogsTable
          data={data}
          columns={columns}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          onOpenDetail={openDetail}
          onClear={clearFilters}
        />
      </div>
    );
  }

  return (
    <ConsolePage id="logs" title={t('meta.title')} actions={<RefreshButton onRefresh={reload} />}>
      <LogsFilters
        selection={selection}
        range={range ?? presetRange(DEFAULT_PRESET)}
        today={today ?? undefined}
        since={since ?? undefined}
        options={options.data}
        onChange={changeSelection}
        dirty={!isDefaultSelection(selection)}
        onClear={clearFilters}
        exporting={exporting}
        exportFailed={exportFailed}
        canExport={filters !== null && (data?.total ?? 0) > 0}
        onExport={() => void exportCsv()}
        columns={columns}
        onSaveColumns={saveColumns}
      />
      {body}
      <LogsDetailSheet log={detail} onClose={() => setDetail(null)} />
    </ConsolePage>
  );
}
