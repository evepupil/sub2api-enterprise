'use client';

/**
 * 管理员配额申请面板（组织所有者）。
 *
 * 契约来源：design/team-and-delivery.md 页面 14 配额申请章节、
 * src/features/organization/types.ts、.fleet/briefs/m45-quota-requests-api.md。
 *
 * 边界：
 * - 列表只走 request-api 的 fetchQuotaRequests，20 条分页；状态筛选是
 *   全部 / pending / granted / rejected / withdrawn，未知状态按 unknown 展示。
 * - 只有 pending 且 canReviewRequest 为真才显示同意/拒绝；审批弹窗必须
 *   先展示成员与金额，备注最长 500 个 Unicode 码点。
 * - 后端同意时可能已把申请作废后返回错误，因此审批结束无论成败都在 finally
 *   失效申请与成员查询，不能只在成功路径刷新。
 * - 规则按钮打开 RequestPolicyDialog，保存后刷新申请相关查询。
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Alert } from '../../components/ui/alert';
import { Badge, type BadgeVariant } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
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
import { organizationErrorText } from './errors';
import { formatOrganizationDate, formatOrganizationMoney, organizationMemberLabel } from './format';
import { fetchQuotaRequests } from './request-api';
import { canReviewRequest } from './request-validation';
import { RequestPolicyDialog } from './request-policy-dialog';
import { RequestReviewDialog, type ReviewAction } from './request-review-dialog';
import type { QuotaRequestRecord, QuotaRequestStatus, RequestFilters } from './types';

/** 规格固定：申请列表每页 20 条。 */
const PAGE_SIZE = 20;

/** 「全部状态」在 Radix Select 中的哨兵值（value 必须是字符串）。 */
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

function statusMeta(status: QuotaRequestStatus): { label: string; variant: BadgeVariant } {
  return STATUS_META[status];
}

/** 审批信息：已审批显示说明与时间；未审批不伪造内容。 */
function reviewSummary(record: QuotaRequestRecord): string {
  const parts: string[] = [];
  if (record.status === 'pending') {
    return '待审批';
  }
  if (record.status === 'withdrawn') {
    return '成员已撤回';
  }
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

interface ReviewTarget {
  record: QuotaRequestRecord;
  action: ReviewAction;
}

function OwnerRequestsPanelInner() {
  const { request, identityKey } = useAuth();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<Exclude<QuotaRequestStatus, 'unknown'> | 'any'>('any');
  const [page, setPage] = useState(1);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [target, setTarget] = useState<ReviewTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filters: RequestFilters = {
    page,
    pageSize: PAGE_SIZE,
    status: status === 'any' ? undefined : status,
  };

  const query = usePortalQuery(
    ['organization', 'quota-requests', filters.page, filters.pageSize, filters.status ?? ''],
    (req: ApiRequester, signal: AbortSignal) => fetchQuotaRequests(req, filters, signal),
  );

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pages = query.data?.pages ?? 0;
  const hasPrevious = page > 1;
  const hasNext = pages > 0 && page < pages;

  function invalidateOrganization() {
    void queryClient.invalidateQueries({ queryKey: ['portal', identityKey, 'organization'] });
  }

  async function handleSettled() {
    // 审批失败也可能是后端已改状态，申请与成员都要重新读取。
    invalidateOrganization();
    const refreshed = await query.refetch();
    if (refreshed.isError) {
      setActionError('暂时无法确认审批结果，请刷新列表后查看');
      setTarget(null);
      return;
    }
    // 写入成功但响应丢失时，以重新读取的状态决定能否继续审批。
    setTarget((current) => {
      if (current === null) return null;
      const record = refreshed.data?.items.find((item) => item.id === current.record.id);
      return record?.status === 'pending' ? { ...current, record } : null;
    });
  }

  function openReview(record: QuotaRequestRecord, action: ReviewAction) {
    if (!canReviewRequest(record)) {
      return;
    }
    setActionError(null);
    setTarget({ record, action });
  }

  function handleReviewFailure(message: string) {
    setActionError(message);
    setTarget(null);
  }

  async function handlePolicySaved() {
    invalidateOrganization();
    await query.refetch();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <CardTitle>配额申请</CardTitle>
            <p className="text-sm text-muted-foreground">
              成员提交的配额申请在这里审批；同意后按申请金额发放。
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setPolicyOpen(true)}>
            申请规则
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full space-y-2 md:w-56">
            <Label htmlFor="request-status">状态</Label>
            <Select
              value={status === 'any' ? ANY_STATUS : status}
              onValueChange={(value) => {
                setStatus(
                  value === ANY_STATUS ? 'any' : (value as Exclude<QuotaRequestStatus, 'unknown'>),
                );
                setPage(1);
              }}
            >
              <SelectTrigger id="request-status" aria-label="申请状态筛选">
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

          {actionError !== null ? <Alert variant="destructive" title={actionError} /> : null}

          {query.isError ? (
            <Alert
              variant="destructive"
              title={organizationErrorText(query.error, '配额申请列表加载失败')}
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

          {query.isPending ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : query.isError ? (
            <EmptyState
              title="暂时无法显示配额申请"
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
              title={status === 'any' ? '还没有配额申请' : '没有该状态的配额申请'}
              description={
                status === 'any' ? '成员提交申请后会显示在这里。' : '可以切换状态筛选查看其他申请。'
              }
            />
          ) : (
            <>
              <Table className="min-w-table">
                <TableCaption>
                  共 {total} 条申请，第 {page} 页{pages > 0 ? ` / 共 ${pages} 页` : ''}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>成员</TableHead>
                    <TableHead>申请金额</TableHead>
                    <TableHead>理由</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>审批信息</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((record) => {
                    const meta = statusMeta(record.status);
                    const reviewable = canReviewRequest(record);
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="min-w-0">
                          <div className="break-words font-medium text-foreground">
                            {organizationMemberLabel(record)}
                          </div>
                          <div className="break-all text-xs text-muted-foreground">
                            {record.email}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">
                          {formatOrganizationMoney(record.amount)}
                        </TableCell>
                        <TableCell className="min-w-0">
                          <span className="block truncate" title={record.reason}>
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
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm text-foreground">
                            {formatOrganizationDate(record.createdAt)}
                          </div>
                          {record.reviewedAt !== null ? (
                            <div className="text-xs text-muted-foreground">
                              审批于 {formatOrganizationDate(record.reviewedAt)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {reviewable ? (
                            <div className="flex min-w-0 flex-wrap items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openReview(record, 'approve')}
                              >
                                同意
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => openReview(record, 'reject')}
                              >
                                拒绝
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">无需操作</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
                <p className="text-sm text-muted-foreground">
                  共 {total} 条申请，第 {page}
                  {pages > 0 ? ` / ${pages}` : ''} 页
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

      {policyOpen ? (
        <RequestPolicyDialog
          request={request}
          onClose={() => setPolicyOpen(false)}
          onSaved={handlePolicySaved}
        />
      ) : null}

      {target !== null ? (
        <RequestReviewDialog
          key={`${target.record.id}-${target.action}`}
          record={target.record}
          action={target.action}
          request={request}
          onClose={() => setTarget(null)}
          onFailure={handleReviewFailure}
          onSettled={handleSettled}
        />
      ) : null}
    </div>
  );
}

/** 非 owner 的兜底：即使父级误挂载也不发管理员请求。 */
function NotOwnerNotice() {
  return (
    <EmptyState
      title="只有组织所有者可以审批配额申请"
      description="如需申请配额，请在概览页的配额区提交。"
    />
  );
}

export function OwnerRequestsPanel() {
  const { user, status } = useAuth();
  if (status === 'loading') {
    return <Skeleton className="h-40 w-full" />;
  }
  if (user === null || user.organization === null || !user.organization.isOwner) {
    return <NotOwnerNotice />;
  }
  return <OwnerRequestsPanelInner />;
}
