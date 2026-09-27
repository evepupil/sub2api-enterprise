'use client';

/**
 * 普通成员的本人配额申请历史（含撤回）。
 *
 * 契约来源：design/team-and-delivery.md「成员申请弹窗」、
 * src/features/organization/types.ts、.fleet/briefs/m45-quota-requests-api.md。
 *
 * 边界：
 * - 只展示当前登录成员自己的申请（服务端按身份返回）；10 条分页，
 *   状态筛选可选，未知状态按 unknown 展示，不套用 pending。
 * - 只有 pending 且记录 userId 与当前账号一致时才显示撤回，撤回前二次确认；
 *   撤回是写操作，提交期间禁止连点，写请求本身不重试。
 * - 读请求带 AbortSignal，关闭弹窗时在途响应失效。
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/alert';
import { Badge, type BadgeVariant } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { EmptyState } from '../../components/ui/empty-state';
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { useAuth } from '../auth/auth-provider';
import type { ApiRequester } from '../auth/types';
import { usePortalQuery } from '../console/use-portal-query';
import { organizationErrorText } from './errors';
import { formatOrganizationDate, formatOrganizationMoney } from './format';
import { fetchQuotaRequests, withdrawQuotaRequest } from './request-api';
import { canWithdrawRequest } from './request-validation';
import type { QuotaRequestRecord, QuotaRequestStatus, RequestFilters } from './types';

/** 规格固定：本人申请历史每页 10 条。 */
const PAGE_SIZE = 10;

/** 「全部状态」在 Radix Select 里的哨兵值（item value 不能为空字符串）。 */
const ANY_STATUS = '__any__';

const STATUS_OPTIONS: readonly {
  value: Exclude<QuotaRequestStatus, 'unknown'>;
  label: string;
}[] = [
  { value: 'pending', label: '待审批' },
  { value: 'granted', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'withdrawn', label: '已撤回' },
];

const STATUS_META: Record<QuotaRequestStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: '待审批', variant: 'warning' },
  granted: { label: '已通过', variant: 'success' },
  rejected: { label: '已拒绝', variant: 'destructive' },
  withdrawn: { label: '已撤回', variant: 'neutral' },
  unknown: { label: '状态未知', variant: 'neutral' },
};

/** 审批说明：待审批/已撤回不伪造内容，其余拼接发放额、备注与时间。 */
function reviewSummary(record: QuotaRequestRecord): string {
  if (record.status === 'pending') return '待审批';
  if (record.status === 'withdrawn') return '已撤回';
  const parts: string[] = [];
  if (record.grantedAmount !== null) {
    parts.push(`发放 ${formatOrganizationMoney(record.grantedAmount)}`);
  }
  if (record.reviewNote.trim() !== '') {
    parts.push(record.reviewNote);
  }
  if (record.reviewedAt !== null) {
    parts.push(formatOrganizationDate(record.reviewedAt));
  }
  return parts.length === 0 ? '—' : parts.join(' · ');
}

export interface MemberRequestListProps {
  /** 当前登录成员编号；与记录 userId 一致才允许撤回。 */
  userId: number | null;
}

export function MemberRequestList({ userId }: MemberRequestListProps) {
  const { request, identityKey } = useAuth();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<Exclude<QuotaRequestStatus, 'unknown'> | 'any'>('any');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<QuotaRequestRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filters: RequestFilters = {
    page,
    pageSize: PAGE_SIZE,
    status: status === 'any' ? undefined : status,
  };

  const query = usePortalQuery(
    ['organization', 'own-quota', 'requests', filters.page, filters.pageSize, filters.status ?? ''],
    (request: ApiRequester, signal: AbortSignal) => fetchQuotaRequests(request, filters, signal),
  );

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pages = query.data?.pages ?? 0;

  function invalidateOwnQuota() {
    void queryClient.invalidateQueries({
      queryKey: ['portal', identityKey, 'organization', 'own-quota'],
    });
  }

  async function handleWithdraw() {
    if (target === null || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await withdrawQuotaRequest(request, target.id);
      setTarget(null);
    } catch (error) {
      setActionError(organizationErrorText(error, '撤回申请失败，请稍后重试'));
    } finally {
      // 无论成败都重新读取：服务端可能已改变申请状态。
      invalidateOwnQuota();
      await query.refetch();
      setBusy(false);
    }
  }

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">我的申请</h3>
          <p className="text-xs text-muted-foreground">只显示本人提交的配额申请。</p>
        </div>
        <div className="w-full md:w-44">
          <label htmlFor="member-request-status" className="sr-only">
            申请状态筛选
          </label>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(
                value === ANY_STATUS ? 'any' : (value as Exclude<QuotaRequestStatus, 'unknown'>),
              );
              setPage(1);
            }}
          >
            <SelectTrigger id="member-request-status" aria-label="申请状态筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_STATUS}>全部状态</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {actionError !== null ? <Alert variant="destructive" title={actionError} /> : null}

      {query.isPending ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : query.isError ? (
        <Alert
          variant="destructive"
          title={organizationErrorText(query.error, '申请历史加载失败')}
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
      ) : rows.length === 0 ? (
        <EmptyState
          title={status === 'any' ? '还没有配额申请' : '没有该状态的申请'}
          description={
            status === 'any' ? '提交申请后可以在这里查看进度。' : '可以切换状态筛选查看其他申请。'
          }
        />
      ) : (
        <>
          <Table className="min-w-table">
            <TableHeader>
              <TableRow>
                <TableHead>申请金额</TableHead>
                <TableHead>理由</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>审批说明</TableHead>
                <TableHead>时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((record) => {
                const meta = STATUS_META[record.status];
                const withdrawable = userId !== null && canWithdrawRequest(record, userId);
                return (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatOrganizationMoney(record.amount)}
                    </TableCell>
                    <TableCell className="min-w-0">
                      <span className="block break-words" title={record.reason}>
                        {record.reason.trim() === '' ? '未填写' : record.reason}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="min-w-0">
                      <span className="block break-words text-sm text-muted-foreground">
                        {reviewSummary(record)}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatOrganizationDate(record.createdAt)}
                    </TableCell>
                    <TableCell>
                      {withdrawable ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={busy}
                          onClick={() => {
                            setActionError(null);
                            setTarget(record);
                          }}
                        >
                          撤回
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
            <p className="text-xs text-muted-foreground">
              共 {total} 条 · 第 {page} / {Math.max(pages, 1)} 页
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pages === 0 || page >= pages}
                onClick={() => setPage((current) => current + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setTarget(null);
        }}
      >
        <DialogContent className="max-w-dialog">
          <DialogHeader>
            <DialogTitle>撤回申请</DialogTitle>
            <DialogDescription>
              {target === null
                ? ''
                : `确认撤回 ${formatOrganizationMoney(target.amount)} 的配额申请？撤回后需重新提交。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setTarget(null)}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={busy}
              onClick={() => void handleWithdraw()}
            >
              确认撤回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
