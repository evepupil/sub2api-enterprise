'use client';

import { useLocale, useTranslations } from 'next-intl';

import { CopyButton } from '@/components/console/copy-button';
import { Panel } from '@/components/console/panel';
import { StatCard } from '@/components/console/stat-card';
import { Badge } from '@/components/ui/badge';
import type { AppLocale } from '@/i18n/routing';
import { getEdition } from '@/lib/catalog';
import { formatUsd, ORGANIZATION, orgSummary, type OrgMember } from '@/lib/console';

/**
 * 组织信息条加四张数字卡。数字跟着成员列表走：
 * 停用、移除成员或调整配额后，成员数和配额合计立刻变化。
 */
export function OrganizationInfo({ members }: { members: readonly OrgMember[] }) {
  const t = useTranslations('consoleOrg');
  const locale = useLocale() as AppLocale;
  const summary = orgSummary(members);
  const groupNames = ORGANIZATION.groups
    .map((id) => getEdition(id).name[locale])
    .join(t('stats.groupsSeparator'));

  return (
    <div className="space-y-4">
      <Panel id="org-info">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <p className="min-w-0 truncate text-lg font-semibold text-foreground">
            {ORGANIZATION.name[locale]}
          </p>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-subtle-foreground">{t('info.orgId')}</span>
            <span className="font-mono text-foreground">{ORGANIZATION.id}</span>
            <CopyButton name="org-id" value={ORGANIZATION.id} label={t('actions.copyOrgId')} />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('info.createdOn', { date: ORGANIZATION.createdAt })}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-subtle-foreground">{t('info.yourRole')}</span>
            <Badge tone="dark">{t('roles.admin')}</Badge>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          id="members"
          label={t('stats.members')}
          value={`${summary.active}/${summary.members}`}
          sub={t('stats.membersSub')}
        />
        <StatCard
          id="month-used"
          label={t('stats.monthUsed')}
          value={formatUsd(summary.monthUsedUsd)}
        />
        <StatCard
          id="quota-total"
          label={t('stats.quotaTotal')}
          value={formatUsd(summary.quotaTotalUsd)}
          sub={t('stats.quotaTotalSub')}
        />
        <StatCard
          id="groups"
          label={t('stats.groups')}
          value={t('stats.groupsValue', { count: ORGANIZATION.groups.length })}
          sub={groupNames}
        />
      </div>
    </div>
  );
}
