'use client';

/**
 * 组织成员面板：搜索、状态筛选、分页与成员行操作。
 *
 * 契约来源：design/team-and-delivery.md 页面 14 成员章节、
 * src/features/organization/types.ts 与冻结的 api.ts。
 *
 * 边界：
 * - 搜索只按邮箱或用户名提交，界面文案不说可搜显示姓名；筛选变化与翻页都会清空勾选，
 *   勾选只针对当前页的非所有者成员。
 * - 所有者行没有勾选框，也不提供启停/额度操作，只允许编辑自己的显示名称；
 *   状态为 unknown 的成员不提供任何启停操作。
 * - 金额缺失（null）一律显示占位符，不当作 0；未知状态不伪造成功或正常。
 * - 写操作成功后通过 useOrganizationRefresh 失效组织查询；本组件不接触令牌、不自行重试。
 */

import { useState } from 'react';

import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
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
import { fetchMembers, setMemberStatus } from './api';
import { BatchQuotaDialog } from './batch-quota-dialog';
import { organizationErrorText } from './errors';
import { formatOrganizationDate, formatOrganizationMoney, organizationMemberLabel } from './format';
import { canManageMember, useOrganizationRefresh } from './member-shared';
import { MemberDialog } from './member-dialog';
import { QuotaEditor } from './quota-editor';
import type { MemberFilters, MemberStatus, OrganizationMember } from './types';

/** 规格固定：成员列表每页 20 条。 */
const PAGE_SIZE = 20;

/** 状态筛选哨兵值：Radix Select 不接受空字符串 item value。 */
const ANY_STATUS = '__any__';

const STATUS_FILTER_OPTIONS: readonly { value: string; label: string }[] = [
  { value: ANY_STATUS, label: '全部状态' },
  { value: 'active', label: '正常' },
  { value: 'disabled', label: '已停用' },
];

const STATUS_BADGE: Record<
  MemberStatus,
  { label: string; variant: 'success' | 'neutral' | 'warning' }
> = {
  active: { label: '正常', variant: 'success' },
  disabled: { label: '已停用', variant: 'neutral' },
  unknown: { label: '状态未知', variant: 'warning' },
};

export function MembersPanel() {
  const { request } = useAuth();
  const refreshOrganization = useOrganizationRefresh();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(ANY_STATUS);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<OrganizationMember | null>(null);
  const [quotaMember, setQuotaMember] = useState<OrganizationMember | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [stopTarget, setStopTarget] = useState<OrganizationMember | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filters: MemberFilters = {
    page,
    pageSize: PAGE_SIZE,
    search: search === '' ? undefined : search,
    status: status === ANY_STATUS ? undefined : (status as 'active' | 'disabled'),
  };

  const query = usePortalQuery(
    [
      'organization',
      'members',
      filters.page,
      filters.pageSize,
      filters.search ?? '',
      filters.status ?? '',
    ],
    (request: ApiRequester, signal: AbortSignal) => fetchMembers(request, filters, signal),
  );

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pages = query.data?.pages ?? 0;
  const hasPrevious = page > 1;
  const hasNext = pages > 0 && page < pages;

  const selectableIds = rows.filter(canManageMember).map((member) => member.userId);
  const selectedMembers = rows.filter(
    (member) => canManageMember(member) && selectedIds.includes(member.userId),
  );
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  function clearSelection() {
    setSelectedIds([]);
  }

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
    clearSelection();
  }

  function toggleMember(member: OrganizationMember, next: boolean) {
    if (!canManageMember(member)) {
      return;
    }
    setSelectedIds((previous) =>
      next
        ? Array.from(new Set([...previous, member.userId]))
        : previous.filter((id) => id !== member.userId),
    );
  }

  async function toggleStatus(member: OrganizationMember, next: 'active' | 'disabled') {
    if (busyId !== null || member.status === 'unknown' || member.isOwner) {
      return;
    }
    setBusyId(member.userId);
    setActionError(null);
    try {
      await setMemberStatus(request, member.userId, next);
      await refreshOrganization();
      setStopTarget(null);
    } catch (error) {
      setActionError(organizationErrorText(error, '修改成员状态失败，请稍后重试'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaved(_member: OrganizationMember, self: boolean) {
    await refreshOrganization({ self });
  }

  return (
    <div className="space-y-4">
      <Card className="min-w-0">
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              applySearch();
            }}
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="members-search">搜索成员</Label>
              <Input
                id="members-search"
                name="search"
                autoComplete="off"
                value={searchInput}
                onChange={(event) => setSearchInput(event.currentTarget.value)}
                placeholder="按邮箱或用户名搜索"
              />
            </div>
            <div className="w-full space-y-2 md:w-48">
              <Label htmlFor="members-status">状态</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                  clearSelection();
                }}
              >
                <SelectTrigger id="members-status" aria-label="状态筛选">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">搜索</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setStatus(ANY_STATUS);
                  setPage(1);
                  clearSelection();
                }}
              >
                重置
              </Button>
            </div>
          </form>

          {query.isError ? (
            <Alert
              variant="destructive"
              title={organizationErrorText(query.error, '成员列表加载失败')}
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

          {actionError !== null ? <Alert variant="destructive" title={actionError} /> : null}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardContent className="space-y-4">
          {selectedMembers.length > 0 ? (
            <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
              <p className="text-sm text-muted-foreground">
                已选 {selectedMembers.length} 位成员（仅当前页）
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={() => setBatchOpen(true)}>
                  批量设置额度
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={clearSelection}>
                  清空选择
                </Button>
              </div>
            </div>
          ) : null}

          {query.isPending ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : query.isError ? (
            <EmptyState
              title="暂时无法显示成员列表"
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
              title={
                search !== '' || status !== ANY_STATUS ? '没有符合条件的成员' : '还没有其他成员'
              }
              description={
                search !== '' || status !== ANY_STATUS
                  ? '可以调整搜索词或状态筛选后重试。'
                  : '通过邀请码邀请成员加入后，这里会显示组织成员。'
              }
            />
          ) : (
            <>
              <Table className="min-w-table">
                <TableCaption>
                  共 {total} 位成员，第 {page} 页{pages > 0 ? ` / 共 ${pages} 页` : ''}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        aria-label="选择当前页全部可管理成员"
                        checked={allSelected}
                        disabled={selectableIds.length === 0}
                        onChange={(event) => {
                          if (event.currentTarget.checked) {
                            setSelectedIds(selectableIds);
                          } else {
                            clearSelection();
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>姓名与邮箱</TableHead>
                    <TableHead>身份</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>额度模式</TableHead>
                    <TableHead>上限 / 已用</TableHead>
                    <TableHead>冻结</TableHead>
                    <TableHead>剩余</TableHead>
                    <TableHead>下次重置</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((member) => {
                    const badge = STATUS_BADGE[member.status];
                    const label = organizationMemberLabel(member);
                    const canManage = !member.isOwner && member.status !== 'unknown';
                    return (
                      <TableRow key={member.userId}>
                        <TableCell>
                          {canManageMember(member) ? (
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              aria-label={`选择成员 ${label}`}
                              checked={selectedIds.includes(member.userId)}
                              onChange={(event) =>
                                toggleMember(member, event.currentTarget.checked)
                              }
                            />
                          ) : null}
                        </TableCell>
                        <TableCell className="min-w-0">
                          <div className="break-words font-medium text-foreground" title={label}>
                            {label}
                          </div>
                          <div
                            className="break-all text-xs text-muted-foreground"
                            title={member.email}
                          >
                            {member.email}
                          </div>
                        </TableCell>
                        <TableCell>{member.isOwner ? <Badge>所有者</Badge> : '成员'}</TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {member.quota === null
                            ? '固定上限'
                            : member.quota.mode === 'periodic_active'
                              ? '周期额度（已生效）'
                              : '周期额度（待生效）'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatOrganizationMoney(member.limit)} /{' '}
                          {formatOrganizationMoney(member.used)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatOrganizationMoney(member.frozen)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatOrganizationMoney(member.remaining)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatOrganizationDate(member.quota?.windowEnd ?? null)}
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 flex-wrap items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditing(member)}
                            >
                              编辑姓名
                            </Button>
                            {canManage ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setQuotaMember(member)}
                                >
                                  设置额度
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (member.status === 'active') {
                                      setStopTarget(member);
                                    } else {
                                      void toggleStatus(member, 'active');
                                    }
                                  }}
                                >
                                  {member.status === 'active' ? '停用' : '启用'}
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
                <p className="text-sm text-muted-foreground">
                  共 {total} 位成员，第 {page}
                  {pages > 0 ? ` / ${pages}` : ''} 页
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!hasPrevious}
                    onClick={() => {
                      setPage((previous) => Math.max(1, previous - 1));
                      clearSelection();
                    }}
                  >
                    上一页
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!hasNext}
                    onClick={() => {
                      setPage((previous) => previous + 1);
                      clearSelection();
                    }}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {editing !== null ? (
        <MemberDialog
          key={`name-${editing.userId}`}
          member={editing}
          request={request}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {quotaMember !== null ? (
        <QuotaEditor
          key={`quota-${quotaMember.userId}`}
          member={quotaMember}
          request={request}
          onClose={() => setQuotaMember(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {batchOpen ? (
        <BatchQuotaDialog
          members={selectedMembers.filter(canManageMember)}
          request={request}
          onClose={() => setBatchOpen(false)}
          onSaved={async () => {
            clearSelection();
            await refreshOrganization();
          }}
        />
      ) : null}

      {stopTarget !== null ? (
        <Dialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen && busyId === null) {
              setStopTarget(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>停用成员</DialogTitle>
              <DialogDescription>
                确认停用「{organizationMemberLabel(stopTarget)}」？停用后该成员无法继续调用接口，
                账号与历史记录保留，可随时重新启用。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busyId !== null}
                onClick={() => setStopTarget(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={busyId === stopTarget.userId}
                onClick={() => {
                  void toggleStatus(stopTarget, 'disabled');
                }}
              >
                确认停用
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
