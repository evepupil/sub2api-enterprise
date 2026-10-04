'use client';

import { Check, Inbox, TriangleAlert, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/console/button';
import { CONTROL_BUTTON } from '@/components/console/control-button';
import { EmptyState } from '@/components/console/empty-state';
import { Pagination } from '@/components/console/pagination';
import { Panel } from '@/components/console/panel';
import { Select, type SelectOption } from '@/components/console/select';
import { Skeleton } from '@/components/console/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatUsd } from '@/lib/console';
import type { Loadable } from '@/lib/console/live/loadable';
import type {
  QuotaRequest,
  QuotaRequestPolicy,
  QuotaRequestsPage,
  QuotaRequestStatusFilter,
} from '@/lib/console/live/org-types';
import { cn } from '@/lib/utils';

import { memberLabel } from './organization-model';
import { minuteOf, OrgIconButton, OrgPanelError, REQUEST_TONE } from './organization-shared';

const STATUS_FILTERS: readonly QuotaRequestStatusFilter[] = [
  'pending',
  'all',
  'granted',
  'rejected',
  'withdrawn',
];

/**
 * 配额申请区（组织管理员）：标题行是状态筛选与「申请设置」；没开申请时直接写出来，免得像坏了。
 * 每条申请写申请人、金额、理由、时间、状态与审批备注，待处理的可以通过或驳回。
 */
export function OrgRequests({
  policy,
  requests,
  status,
  onStatus,
  onSettings,
  onApprove,
  onReject,
  busy,
  error,
  onPage,
  onPageSize,
  onRetry,
}: {
  policy: Loadable<QuotaRequestPolicy>;
  requests: Loadable<QuotaRequestsPage>;
  status: QuotaRequestStatusFilter;
  onStatus: (value: QuotaRequestStatusFilter) => void;
  onSettings: () => void;
  onApprove: (request: QuotaRequest) => void;
  onReject: (request: QuotaRequest) => void;
  busy: ReadonlySet<number>;
  /** 通过失败时的一句话 */
  error: string | null;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onRetry: () => void;
}) {
  const t = useTranslations('consoleOrg');
  const data = requests.data;
  const off = policy.data?.mode === 'off';
  const statusOptions: SelectOption<QuotaRequestStatusFilter>[] = STATUS_FILTERS.map((value) => ({
    value,
    label: t(`requests.status.${value}`),
  }));

  let body: React.ReactNode;
  if ((policy.error && policy.data === null) || (requests.error && data === null)) {
    body = (
      <EmptyState
        id="org-requests-error"
        icon={TriangleAlert}
        bordered={false}
        title={t('loadError.title')}
        action={
          <Button variant="secondary" onClick={onRetry}>
            {t('loadError.retry')}
          </Button>
        }
      />
    );
  } else if (policy.data === null || data === null) {
    body = <Skeleton className="h-24" />;
  } else if (off) {
    body = (
      <p data-org-requests-off className="py-6 text-center text-sm text-muted-foreground">
        {t('requests.off')}
      </p>
    );
  } else if (data.items.length === 0) {
    body = (
      <EmptyState id="org-requests" icon={Inbox} bordered={false} title={t('requests.empty')} />
    );
  } else {
    body = (
      <ul
        className={cn(
          'divide-y divide-border transition-opacity',
          requests.loading && 'opacity-60',
        )}
      >
        {data.items.map((request) => (
          <li
            key={request.id}
            data-org-request={request.id}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-baseline gap-2">
                <span
                  className="truncate text-sm font-medium text-foreground"
                  title={request.email}
                >
                  {memberLabel(request)}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatUsd(request.amount)}
                </span>
              </div>
              {request.reason ? (
                <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">
                  {request.reason}
                </p>
              ) : null}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle-foreground">
                <span className="tabular-nums">{minuteOf(request.createdAt)}</span>
                <Badge tone={REQUEST_TONE[request.status]} data-org-request-status={request.status}>
                  {t(`requests.status.${request.status}`)}
                </Badge>
                {request.reviewNote ? (
                  <span className="min-w-0 max-w-full truncate" title={request.reviewNote}>
                    {request.reviewNote}
                  </span>
                ) : null}
              </div>
            </div>
            {request.status === 'pending' ? (
              <div className="flex shrink-0 gap-1">
                <OrgIconButton
                  icon={Check}
                  tone="success"
                  label={t('requests.approve')}
                  data-org-approve={request.id}
                  disabled={busy.has(request.id)}
                  onClick={() => onApprove(request)}
                />
                <OrgIconButton
                  icon={X}
                  tone="danger"
                  label={t('requests.reject')}
                  data-org-reject={request.id}
                  disabled={busy.has(request.id)}
                  onClick={() => onReject(request)}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Panel
      id="org-requests"
      title={t('requests.title')}
      actions={
        <>
          {off ? null : (
            <Select
              name="org-request-status"
              value={status}
              onChange={onStatus}
              options={statusOptions}
              ariaLabel={t('requests.statusLabel')}
              className="w-32"
            />
          )}
          <Button
            variant="secondary"
            className={CONTROL_BUTTON}
            disabled={policy.data === null}
            onClick={onSettings}
            data-org-policy-open
          >
            {t('requests.settings')}
          </Button>
        </>
      }
      bodyClassName="space-y-3"
    >
      <OrgPanelError message={error} />
      {body}
      {data && !off && data.total > data.pageSize ? (
        <div className="-mx-5 border-t border-border px-4 pt-3">
          <Pagination
            page={data.page}
            pages={Math.max(1, Math.ceil(data.total / data.pageSize))}
            total={data.total}
            pageSize={data.pageSize}
            onPageChange={onPage}
            onPageSizeChange={onPageSize}
          />
        </div>
      ) : null}
    </Panel>
  );
}
