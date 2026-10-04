'use client';

import { KeyRound, Plus, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/console/button';
import { ConsolePage } from '@/components/console/console-page';
import { CONTROL_BUTTON } from '@/components/console/control-button';
import { ConfirmDialog } from '@/components/console/dialog';
import { EmptyState } from '@/components/console/empty-state';
import { SearchInput } from '@/components/console/filter-field';
import { Pagination } from '@/components/console/pagination';
import { RefreshButton } from '@/components/console/refresh-button';
import { Select, type SelectOption } from '@/components/console/select';
import { Skeleton } from '@/components/console/skeleton';
import { DEFAULT_PAGE_SIZE } from '@/lib/console/pagination';
import { deleteKey, fetchKeyGroups, fetchKeys, updateKey } from '@/lib/console/live/keys-client';
import {
  KEY_STATUSES,
  type KeyErrorReason,
  type KeyGroupOption,
  type KeysPageData,
  type KeysQuery,
  type KeyStatusFilter,
  type LiveKey,
} from '@/lib/console/live/keys-types';
import { useLoadable } from '@/lib/console/live/loadable';
import { useDebouncedValue } from '@/lib/console/live/use-debounced-value';
import { useLiveClock } from '@/lib/console/live/use-live-clock';
import { cn } from '@/lib/utils';

import { KeysCreateDialog } from './keys-create-dialog';
import { KeysEditDialog } from './keys-edit-dialog';
import { KeysTable } from './keys-table';
import { KeysUsageDialog } from './keys-usage-dialog';

/** 当前打开的弹窗：同一时刻只有一个；编辑、接入、删除带着那一行 */
type KeysDialog =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; key: LiveKey }
  | { kind: 'usage'; key: LiveKey }
  | { kind: 'delete'; key: LiveKey };

/** 搜索框停下这么久才去查 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * API 密钥页（接后端）：搜索与状态筛选、密钥表（后端分页）、创建 / 编辑 / 接入示例 / 暂停启用 / 删除。
 * 列表带完整密钥与每把密钥近 30 天、今天的用量；任何改动成功后重新读取列表。
 * 换条件时先留着旧数据（变浅），首次加载显示占位块，读不到时整页显示出错与重试。
 */
export function KeysPage() {
  const t = useTranslations('consoleKeys');
  const tc = useTranslations('console');
  const clock = useLiveClock();
  const today = clock?.today ?? null;

  const [searchText, setSearchText] = useState('');
  const search = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState<KeyStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [reloadKey, setReloadKey] = useState(0);
  const [version, setVersion] = useState(0);
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(() => new Set());
  const [busy, setBusy] = useState<ReadonlySet<number>>(() => new Set());
  const [dialog, setDialog] = useState<KeysDialog>({ kind: 'none' });
  const [actionError, setActionError] = useState<KeyErrorReason | null>(null);

  const query: KeysQuery = { page, pageSize, search, status };
  const keys = useLoadable<KeysPageData>(
    `${JSON.stringify(query)}|${reloadKey}|${version}`,
    (signal) => fetchKeys(query, signal),
  );
  const groups = useLoadable<KeyGroupOption[]>(`groups|${reloadKey}`, (signal) =>
    fetchKeyGroups(signal),
  );

  const filtered = search !== '' || status !== 'all';
  const reload = () => setReloadKey((value) => value + 1);
  /** 改动成功后重新读列表（不重读分组） */
  const refreshList = () => setVersion((value) => value + 1);
  const closeDialog = () => setDialog({ kind: 'none' });

  const statusOptions: SelectOption<KeyStatusFilter>[] = [
    { value: 'all', label: t('filters.allStatuses') },
    ...KEY_STATUSES.map((value) => ({ value, label: t(`status.${value}`) })),
  ];

  const clearFilters = () => {
    setSearchText('');
    setStatus('all');
    setPage(1);
  };

  const toggleReveal = (id: number) =>
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const markBusy = (id: number, on: boolean) =>
    setBusy((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /** 行上的操作（暂停 / 启用、删除）：做完重读列表，失败时在表格上方提示 */
  const runRowAction = async (
    id: number,
    action: () => Promise<{ ok: boolean; reason?: KeyErrorReason }>,
  ) => {
    setActionError(null);
    markBusy(id, true);
    const result = await action();
    markBusy(id, false);
    if (!result.ok) setActionError(result.reason ?? 'unavailable');
    refreshList();
  };

  const toggleStatus = (key: LiveKey) =>
    void runRowAction(key.id, () =>
      updateKey(key.id, { status: key.status === 'active' ? 'inactive' : 'active' }),
    );

  const removeKey = (key: LiveKey) =>
    void runRowAction(key.id, async () => {
      const result = await deleteKey(key.id);
      // 删掉的是这一页最后一条时退回上一页
      if (result.ok && keys.data && keys.data.items.length === 1 && page > 1) setPage(page - 1);
      return result;
    });

  const openCreate = () => setDialog({ kind: 'create' });
  const data = keys.data;
  const stale = data !== null && keys.loading;

  let body: React.ReactNode;
  if (keys.error && data === null) {
    body = (
      <EmptyState
        id="keys-error"
        icon={TriangleAlert}
        title={keys.error === 'too_many' ? t('loadError.tooMany') : t('loadError.title')}
        action={
          <Button variant="secondary" onClick={reload} data-keys-retry>
            {t('loadError.retry')}
          </Button>
        }
      />
    );
  } else if (data === null) {
    body = (
      <div data-keys-loading className="space-y-3">
        <Skeleton className="h-10 w-full sm:w-[28rem]" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  } else if (data.total === 0 && !filtered) {
    body = (
      <EmptyState
        id="keys"
        icon={KeyRound}
        title={t('empty.title')}
        action={
          <Button onClick={openCreate} disabled={today === null}>
            <Plus aria-hidden />
            {t('actions.create')}
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            id="key-search"
            data-key-search
            placeholder={t('filters.searchPlaceholder')}
            aria-label={t('filters.searchPlaceholder')}
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
              setPage(1);
            }}
            className="sm:w-72"
          />
          <Select
            name="key-status"
            value={status}
            onChange={(next) => {
              setStatus(next);
              setPage(1);
            }}
            options={statusOptions}
            ariaLabel={t('filters.statusLabel')}
            className="sm:w-40"
          />
        </div>
        {actionError ? (
          <p role="alert" data-key-error={actionError} className="text-sm text-danger">
            {t(`errors.action.${actionError}`)}
          </p>
        ) : null}
        <div
          data-keys-content
          aria-busy={keys.loading ? 'true' : undefined}
          className={cn('transition-opacity', stale && 'opacity-60')}
        >
          {data.total === 0 ? (
            <EmptyState
              id="keys"
              icon={KeyRound}
              title={t('empty.noResults')}
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  {tc('actions.clearFilters')}
                </Button>
              }
            />
          ) : (
            <KeysTable
              rows={data.items}
              revealed={revealed}
              busy={busy}
              footer={
                <Pagination
                  page={data.page}
                  pages={Math.max(1, Math.ceil(data.total / data.pageSize))}
                  total={data.total}
                  pageSize={data.pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              }
              handlers={(row) => ({
                onToggleReveal: () => toggleReveal(row.id),
                onConnect: () => setDialog({ kind: 'usage', key: row }),
                onEdit: () => setDialog({ kind: 'edit', key: row }),
                onToggleStatus: () => toggleStatus(row),
                onDelete: () => setDialog({ kind: 'delete', key: row }),
              })}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <ConsolePage
      id="keys"
      title={t('meta.title')}
      actions={
        <>
          <RefreshButton onRefresh={reload} />
          <Button
            className={CONTROL_BUTTON}
            data-create-key
            disabled={today === null}
            onClick={openCreate}
          >
            <Plus aria-hidden />
            {t('actions.create')}
          </Button>
        </>
      }
    >
      {body}

      {dialog.kind === 'create' && today !== null ? (
        <KeysCreateDialog
          groups={groups.data ?? []}
          groupsUnavailable={groups.error !== null && groups.data === null}
          today={today}
          onClose={closeDialog}
          onCreated={refreshList}
        />
      ) : null}
      {dialog.kind === 'edit' && today !== null ? (
        <KeysEditDialog
          keyRow={dialog.key}
          groups={groups.data ?? []}
          groupsUnavailable={groups.error !== null && groups.data === null}
          today={today}
          onClose={closeDialog}
          onChanged={refreshList}
        />
      ) : null}
      {dialog.kind === 'usage' ? <KeysUsageDialog row={dialog.key} onClose={closeDialog} /> : null}
      <ConfirmDialog
        id="delete-key"
        open={dialog.kind === 'delete'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={
          <span className="break-words">
            {t('delete.title', { name: dialog.kind === 'delete' ? dialog.key.name : '' })}
          </span>
        }
        description={t('delete.description')}
        confirmLabel={t('actions.delete')}
        onConfirm={() => {
          if (dialog.kind === 'delete') removeKey(dialog.key);
        }}
      />
    </ConsolePage>
  );
}
