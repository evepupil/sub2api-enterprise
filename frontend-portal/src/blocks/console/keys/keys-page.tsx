'use client';

import { KeyRound, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/console/dialog';
import { ConsolePage } from '@/components/console/console-page';
import { CONTROL_BUTTON } from '@/components/console/control-button';
import { RefreshButton } from '@/components/console/refresh-button';
import { EmptyState } from '@/components/console/empty-state';
import { SearchInput } from '@/components/console/filter-field';
import { Pagination, usePagination } from '@/components/console/pagination';
import { Select, type SelectOption } from '@/components/console/select';
import { Button } from '@/components/console/button';
import { API_KEYS, KEY_STATUSES, searchKeys, type KeyStatus } from '@/lib/console';

import { KeysCreateDialog } from './keys-create-dialog';
import { KeysEditDialog } from './keys-edit-dialog';
import { toggleKeyStatus, toKeyRow, type KeyRow } from './keys-model';
import { KeysTable } from './keys-table';
import { KeysUsageDialog } from './keys-usage-dialog';

/** 当前打开的弹窗：同一时刻只有一个，编辑、接入、删除都按密钥编号找到那一行 */
type KeysDialog =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; id: string }
  | { kind: 'usage'; id: string }
  | { kind: 'delete'; id: string };

/**
 * API 密钥页：搜索与状态筛选、密钥表（分页）、创建 / 编辑 / 接入示例 / 删除确认。
 * 所有操作只改本页的列表状态，不发请求；暂停和启用直接切换，不需要确认。
 */
export function KeysPage() {
  const t = useTranslations('consoleKeys');
  const tc = useTranslations('console');
  const [keys, setKeys] = useState<readonly KeyRow[]>(() => API_KEYS.map(toKeyRow));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<KeyStatus | 'all'>('all');
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const [dialog, setDialog] = useState<KeysDialog>({ kind: 'none' });

  const visible = searchKeys(keys, query, status);
  const pager = usePagination(visible, `${query.trim()}|${status}`);

  const statusOptions: SelectOption<KeyStatus | 'all'>[] = [
    { value: 'all', label: t('filters.allStatuses') },
    ...KEY_STATUSES.map((value) => ({ value, label: t(`status.${value}`) })),
  ];

  const closeDialog = () => setDialog({ kind: 'none' });
  const target =
    dialog.kind === 'edit' || dialog.kind === 'usage' || dialog.kind === 'delete'
      ? keys.find((key) => key.id === dialog.id)
      : undefined;

  const clearFilters = () => {
    setQuery('');
    setStatus('all');
  };

  const toggleReveal = (id: string) =>
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openCreate = () => setDialog({ kind: 'create' });

  return (
    <ConsolePage
      id="keys"
      title={t('meta.title')}
      actions={
        <>
          <RefreshButton />
          <Button className={CONTROL_BUTTON} data-create-key onClick={openCreate}>
            <Plus aria-hidden />
            {t('actions.create')}
          </Button>
        </>
      }
    >
      {keys.length === 0 ? (
        <EmptyState
          id="keys"
          icon={KeyRound}
          title={t('empty.title')}
          action={
            <Button onClick={openCreate}>
              <Plus aria-hidden />
              {t('actions.create')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              id="key-search"
              data-key-search
              placeholder={t('filters.searchPlaceholder')}
              aria-label={t('filters.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="sm:w-72"
            />
            <Select
              name="key-status"
              value={status}
              onChange={setStatus}
              options={statusOptions}
              ariaLabel={t('filters.statusLabel')}
              className="sm:w-40"
            />
          </div>

          {visible.length === 0 ? (
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
              rows={pager.items}
              revealed={revealed}
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
              handlers={(row) => ({
                onToggleReveal: () => toggleReveal(row.id),
                onConnect: () => setDialog({ kind: 'usage', id: row.id }),
                onEdit: () => setDialog({ kind: 'edit', id: row.id }),
                onToggleStatus: () =>
                  setKeys((current) =>
                    current.map((key) => (key.id === row.id ? toggleKeyStatus(key) : key)),
                  ),
                onDelete: () => setDialog({ kind: 'delete', id: row.id }),
              })}
            />
          )}
        </>
      )}

      {dialog.kind === 'create' ? (
        <KeysCreateDialog
          onClose={closeDialog}
          onCreated={(row) => setKeys((current) => [row, ...current])}
        />
      ) : null}
      {dialog.kind === 'edit' && target ? (
        <KeysEditDialog
          row={target}
          onClose={closeDialog}
          onSave={(next) =>
            setKeys((current) => current.map((key) => (key.id === next.id ? next : key)))
          }
        />
      ) : null}
      {dialog.kind === 'usage' && target ? (
        <KeysUsageDialog row={target} onClose={closeDialog} />
      ) : null}
      <ConfirmDialog
        id="delete-key"
        open={dialog.kind === 'delete' && target !== undefined}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={
          <span className="break-words">{t('delete.title', { name: target?.name ?? '' })}</span>
        }
        description={t('delete.description')}
        confirmLabel={t('actions.delete')}
        onConfirm={() => {
          if (target) setKeys((current) => current.filter((key) => key.id !== target.id));
        }}
      />
    </ConsolePage>
  );
}
