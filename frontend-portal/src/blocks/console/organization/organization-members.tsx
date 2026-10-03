'use client';

import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Table, TableShell, Th } from '@/components/console/data-table';
import { EmptyState } from '@/components/console/empty-state';
import { SearchInput } from '@/components/console/filter-field';
import type { OrgMember } from '@/lib/console';

import { OrganizationMemberRow } from './organization-member-row';
import { filterMembers } from './organization-model';

/**
 * 成员区：标题加搜索框，下面是成员表。搜不到人时表格里显示空状态，
 * 空状态放在表外面（不在 table 里），小屏横向滚动时也能居中看到。
 */
export function OrganizationMembers({
  members,
  query,
  onQueryChange,
  onAdjustQuota,
  onToggle,
  onRemove,
}: {
  members: readonly OrgMember[];
  query: string;
  onQueryChange: (query: string) => void;
  onAdjustQuota: (id: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const visible = filterMembers(members, query);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-foreground">{t('members.title')}</h2>
        <SearchInput
          id="member-search"
          data-member-search
          placeholder={t('members.searchPlaceholder')}
          aria-label={t('members.searchPlaceholder')}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="sm:w-64"
        />
      </div>

      <TableShell id="members">
        {visible.length === 0 ? (
          <EmptyState id="members" icon={Users} title={t('members.noResults')} bordered={false} />
        ) : (
          <Table minWidth={960}>
            <thead>
              <tr>
                <Th>{t('members.columns.member')}</Th>
                <Th>{t('members.columns.role')}</Th>
                <Th>{t('members.columns.quota')}</Th>
                <Th>{t('members.columns.keys')}</Th>
                <Th>{t('members.columns.status')}</Th>
                <Th>{t('members.columns.joined')}</Th>
                <Th sticky="right" align="right">
                  {tc('table.actions')}
                </Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((member) => (
                <OrganizationMemberRow
                  key={member.id}
                  member={member}
                  onAdjustQuota={() => onAdjustQuota(member.id)}
                  onToggle={() => onToggle(member.id)}
                  onRemove={() => onRemove(member.id)}
                />
              ))}
            </tbody>
          </Table>
        )}
      </TableShell>
    </section>
  );
}
