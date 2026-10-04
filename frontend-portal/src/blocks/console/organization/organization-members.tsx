'use client';

import { TriangleAlert, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/console/button';
import { CONTROL_BUTTON } from '@/components/console/control-button';
import { Table, TableShell, Th } from '@/components/console/data-table';
import { EmptyState } from '@/components/console/empty-state';
import { SearchInput } from '@/components/console/filter-field';
import { Pagination } from '@/components/console/pagination';
import { Select, type SelectOption } from '@/components/console/select';
import { Skeleton } from '@/components/console/skeleton';
import { formatUsd } from '@/lib/console';
import type { Loadable } from '@/lib/console/live/loadable';
import type {
  OrgDefaultQuota,
  OrgMember,
  OrgMembersPage,
  OrgMemberStatusFilter,
} from '@/lib/console/live/org-types';
import { cn } from '@/lib/utils';

import { OrgMemberRow, type OrgMemberRowHandlers } from './organization-member-row';
import { OrgPanelError } from './organization-shared';

/**
 * 成员区：标题行是搜索、状态筛选和两个批量操作（勾选后才能点）；下面一行是新成员默认配额的状态与开启 / 修改；
 * 再下面是成员表（后端分页）。读不到时显示重试，换条件时旧数据变浅。
 */
export function OrgMembers({
  members,
  searchText,
  onSearchText,
  status,
  onStatus,
  selected,
  onSelectPage,
  defaultQuota,
  onDefaultQuota,
  onGrant,
  onSplit,
  busy,
  handlers,
  error,
  onPage,
  onPageSize,
  onRetry,
}: {
  members: Loadable<OrgMembersPage>;
  searchText: string;
  onSearchText: (value: string) => void;
  status: OrgMemberStatusFilter;
  onStatus: (value: OrgMemberStatusFilter) => void;
  selected: ReadonlySet<number>;
  /** 勾上或取消这一页的全部成员（组织管理员本人除外） */
  onSelectPage: (members: readonly OrgMember[], checked: boolean) => void;
  /** 还没读到（或读不到）时不显示默认配额这一行 */
  defaultQuota: OrgDefaultQuota | null;
  onDefaultQuota: () => void;
  onGrant: () => void;
  onSplit: () => void;
  busy: ReadonlySet<number>;
  handlers: (member: OrgMember) => OrgMemberRowHandlers;
  /** 行上操作（停用、启用）失败时的一句话 */
  error: string | null;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onRetry: () => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const data = members.data;
  const stale = data !== null && members.loading;
  const selectable = (data?.items ?? []).filter((member) => !member.isOwner);
  const pageChecked =
    selectable.length > 0 && selectable.every((member) => selected.has(member.userId));
  const suffix = selected.size > 0 ? t('members.selectedCount', { count: selected.size }) : '';

  const statusOptions: SelectOption<OrgMemberStatusFilter>[] = [
    { value: 'all', label: t('members.allStatuses') },
    { value: 'active', label: t('members.status.active') },
    { value: 'disabled', label: t('members.status.disabled') },
  ];

  let body: React.ReactNode;
  if (members.error && data === null) {
    body = (
      <EmptyState
        id="org-members-error"
        icon={TriangleAlert}
        bordered={false}
        title={members.error === 'too_many' ? t('loadError.tooMany') : t('loadError.title')}
        action={
          <Button variant="secondary" onClick={onRetry}>
            {t('loadError.retry')}
          </Button>
        }
      />
    );
  } else if (data === null) {
    body = <Skeleton className="m-5 h-48" />;
  } else if (data.total === 0) {
    body = (
      <EmptyState
        id="org-members"
        icon={Users}
        bordered={false}
        title={searchText.trim() || status !== 'all' ? t('members.noResults') : t('members.empty')}
      />
    );
  } else {
    body = (
      <Table minWidth={960} aria-label={t('members.title')}>
        <thead>
          <tr>
            <Th className="w-10">
              <input
                type="checkbox"
                data-org-select-page
                className="size-4 accent-[var(--foreground)]"
                checked={pageChecked}
                disabled={selectable.length === 0}
                onChange={(event) => onSelectPage(selectable, event.target.checked)}
                aria-label={t('members.selectPage')}
              />
            </Th>
            <Th>{t('members.columns.name')}</Th>
            <Th>{t('members.columns.email')}</Th>
            <Th>{t('members.columns.status')}</Th>
            <Th>{t('members.columns.quota')}</Th>
            <Th>{t('members.columns.used')}</Th>
            <Th>{t('members.columns.remaining')}</Th>
            <Th sticky="right" align="right">
              {tc('table.actions')}
            </Th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((member) => (
            <OrgMemberRow
              key={member.userId}
              member={member}
              selected={selected.has(member.userId)}
              busy={busy.has(member.userId)}
              {...handlers(member)}
            />
          ))}
        </tbody>
      </Table>
    );
  }

  return (
    <section data-org-members className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t('members.title')}</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            id="org-member-search"
            data-org-member-search
            placeholder={t('members.searchPlaceholder')}
            aria-label={t('members.searchPlaceholder')}
            value={searchText}
            onChange={(event) => onSearchText(event.target.value)}
            className="sm:w-56"
          />
          <Select
            name="org-member-status"
            value={status}
            onChange={onStatus}
            options={statusOptions}
            ariaLabel={t('members.statusLabel')}
            className="sm:w-36"
          />
          <Button
            variant="secondary"
            className={CONTROL_BUTTON}
            disabled={selected.size === 0}
            onClick={onGrant}
            data-org-grant
          >
            {t('members.grant')}
            {suffix}
          </Button>
          <Button
            variant="secondary"
            className={CONTROL_BUTTON}
            disabled={selected.size === 0}
            onClick={onSplit}
            data-org-split
          >
            {t('members.split')}
            {suffix}
          </Button>
        </div>
      </div>
      {defaultQuota ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p data-org-default-quota className="text-sm text-muted-foreground">
            {defaultQuota.enabled
              ? t('defaultQuota.on', {
                  amount: formatUsd(defaultQuota.amount ?? 0),
                  days: defaultQuota.periodDays ?? 0,
                })
              : t('defaultQuota.off')}
          </p>
          <Button variant="secondary" size="sm" onClick={onDefaultQuota} data-org-default-open>
            {defaultQuota.enabled ? t('defaultQuota.edit') : t('defaultQuota.enable')}
          </Button>
        </div>
      ) : null}
      <OrgPanelError message={error} />
      <TableShell
        id="org-members"
        footer={
          data && data.total > 0 ? (
            <Pagination
              page={data.page}
              pages={Math.max(1, Math.ceil(data.total / data.pageSize))}
              total={data.total}
              pageSize={data.pageSize}
              onPageChange={onPage}
              onPageSizeChange={onPageSize}
            />
          ) : undefined
        }
      >
        <div
          aria-busy={members.loading ? 'true' : undefined}
          className={cn('transition-opacity', stale && 'opacity-60')}
        >
          {body}
        </div>
      </TableShell>
    </section>
  );
}
