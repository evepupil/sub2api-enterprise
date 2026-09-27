'use client';

/**
 * 密钥管理页面。
 *
 * 契约来源：design/console-pages.md 密钥章节、design/customer-console.md 第 3/4 节。
 *
 * 边界：
 * - 列表、分组、写操作全部走本模块 api.ts；令牌与续期由 useAuth().request 负责，
 *   本组件不接触凭证、不自行重试写操作。
 * - queryKey 包含搜索、状态与分页，任何筛选变化都会取对应页数据，不跨筛选复用旧结果。
 * - 账号切换由父布局按 identityKey 卸载本页，这里只依赖 usePortalQuery 的 key 前缀。
 * - 列表只展示掩码；完整密钥只在创建结果或明确复制动作中出现。
 */

import { useState } from 'react';

import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { PageHeader } from '../../components/layout/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { useAuth } from '../auth/auth-provider';
import type { ApiRequester } from '../auth/types';
import { usePortalQuery } from '../console/use-portal-query';
import { fetchKeys } from './api';
import { KeyEditorDialog } from './key-editor';
import {
  KEY_STATUS_FILTER_OPTIONS,
  formatCount,
  formatDateTime,
  formatExpiry,
  formatQuota,
  keyStatusLabel,
  safeKeyErrorMessage,
} from './key-format';
import { KeyRowActions } from './key-row-actions';
import type { KeyFilters, KeyRecord } from './types';
import { maskKey } from './validation';

/** 规格固定：列表每页 20 条。 */
const PAGE_SIZE = 20;

/** 状态筛选哨兵值，Radix Select 不接受空字符串 item value。 */
const ANY_STATUS = '__any__';

/** 「全部状态」+ 后端实际返回的状态枚举，文案与徽标共用同一来源。 */
const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: ANY_STATUS, label: '全部状态' },
  ...KEY_STATUS_FILTER_OPTIONS,
];

export function KeysView() {
  const { request } = useAuth();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(ANY_STATUS);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<KeyRecord | null>(null);

  const filters: KeyFilters = {
    page,
    pageSize: PAGE_SIZE,
    search: search === '' ? undefined : search,
    status: status === ANY_STATUS ? undefined : status,
  };

  const query = usePortalQuery(
    ['keys', filters.page, filters.pageSize, filters.search ?? '', filters.status ?? ''],
    (req: ApiRequester, signal: AbortSignal) => fetchKeys(req, filters, signal),
  );

  const total = query.data?.total ?? 0;
  const pages = query.data?.pages ?? 0;
  const hasPrevious = page > 1;
  const hasNext = pages > 0 && page < pages;

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(record: KeyRecord) {
    setEditing(record);
    setEditorOpen(true);
  }

  async function handleSaved() {
    await query.refetch();
  }

  const rows = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="密钥管理"
        actions={
          <Button type="button" onClick={openCreate}>
            创建密钥
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              applySearch();
            }}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="keys-search">名称</Label>
              <Input
                id="keys-search"
                name="search"
                autoComplete="off"
                value={searchInput}
                onChange={(event) => setSearchInput(event.currentTarget.value)}
                placeholder="按名称搜索"
              />
            </div>
            <div className="w-full space-y-2 md:w-48">
              <Label htmlFor="keys-status">状态</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="keys-status" aria-label="状态筛选">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">搜索</Button>
          </form>

          {query.isError ? (
            <Alert
              variant="destructive"
              title={safeKeyErrorMessage(query.error, '密钥列表加载失败')}
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void query.refetch();
                  }}
                >
                  重试
                </Button>
              }
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {query.isPending ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : query.isError ? (
            <EmptyState
              title="暂时无法显示密钥列表"
              description="请检查网络后重试。"
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void query.refetch();
                  }}
                >
                  重试
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={search !== '' || status !== ANY_STATUS ? '没有符合条件的密钥' : '还没有密钥'}
              description={
                search !== '' || status !== ANY_STATUS
                  ? '可以调整搜索词或状态筛选后重试。'
                  : '创建后即可用密钥调用模型接口。'
              }
              action={
                <Button type="button" onClick={openCreate}>
                  创建密钥
                </Button>
              }
            />
          ) : (
            <>
              <Table className="min-w-table">
                <TableCaption>
                  共 {formatCount(total)} 条记录，第 {page} 页
                  {pages > 0 ? ` / 共 ${formatCount(pages)} 页` : ''}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称与掩码</TableHead>
                    <TableHead>分组</TableHead>
                    <TableHead>已用/总额度</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>最近使用</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((record: KeyRecord) => {
                    const recordStatus = keyStatusLabel(record.status);
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="min-w-0">
                          <div className="break-words font-medium text-foreground">
                            {record.name}
                          </div>
                          <div className="break-all text-xs text-muted-foreground">
                            {maskKey(record.key)}
                          </div>
                        </TableCell>
                        <TableCell className="break-words">
                          {record.groupName ?? '未指定'}
                        </TableCell>
                        <TableCell>{formatQuota(record.quotaUsed, record.quota)}</TableCell>
                        <TableCell>
                          <Badge variant={recordStatus.variant}>{recordStatus.label}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(record.lastUsedAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatExpiry(record)}</TableCell>
                        <TableCell>
                          <KeyRowActions
                            record={record}
                            request={request}
                            onEdit={openEdit}
                            onChanged={handleSaved}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="mt-4 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
                <p className="text-sm text-muted-foreground">
                  共 {formatCount(total)} 条记录，第 {page}
                  {pages > 0 ? ` / ${formatCount(pages)}` : ''} 页
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!hasPrevious}
                    onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                  >
                    上一页
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!hasNext}
                    onClick={() => setPage((previous) => previous + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {editorOpen ? (
        <KeyEditorDialog
          key={editing === null ? 'create' : `edit-${editing.id}`}
          record={editing}
          request={request}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
