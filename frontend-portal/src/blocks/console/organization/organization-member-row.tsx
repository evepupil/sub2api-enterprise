'use client';

import { Ban, CircleCheck, Pencil, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Td, Tr } from '@/components/console/data-table';
import { Badge } from '@/components/ui/badge';
import { formatUsd } from '@/lib/console';
import type { OrgMember } from '@/lib/console/live/org-types';
import { cn } from '@/lib/utils';

import { isExhausted, memberLabel } from './organization-model';
import { minuteOf, OrgIconButton } from './organization-shared';

const NONE = <span className="text-subtle-foreground">—</span>;

export interface OrgMemberRowHandlers {
  onToggleSelect: () => void;
  onRename: () => void;
  onQuota: () => void;
  onToggleStatus: () => void;
}

/**
 * 成员表的一行：勾选框（组织管理员本人没有）、名称、邮箱与用户名、状态、额度（固定累计上限或周期配额）、
 * 已消费、剩余额度（周期配额写下次重置时间，有冻结金额也写出来）、操作（改名、设置配额、停用 / 启用）。
 * 组织管理员本人只能改名。
 */
export function OrgMemberRow({
  member,
  selected,
  busy,
  onToggleSelect,
  onRename,
  onQuota,
  onToggleStatus,
}: OrgMemberRowHandlers & { member: OrgMember; selected: boolean; busy: boolean }) {
  const t = useTranslations('consoleOrg');
  const active = member.status === 'active';

  let quota: React.ReactNode;
  if (member.isOwner) quota = NONE;
  else if (member.quota) {
    quota = (
      <div className="whitespace-nowrap tabular-nums">
        <div className="text-foreground">{formatUsd(member.quota.amount)}</div>
        <div className="text-xs text-subtle-foreground">
          {t('members.everyDays', { days: member.quota.periodDays })}
          {member.quota.mode === 'periodic_pending' ? ` · ${t('members.pending')}` : ''}
        </div>
      </div>
    );
  } else if (member.spendingLimit === null) {
    quota = <span className="text-muted-foreground">{t('members.unlimited')}</span>;
  } else {
    quota = <span className="tabular-nums text-foreground">{formatUsd(member.spendingLimit)}</span>;
  }

  return (
    <Tr data-org-member={member.userId}>
      <Td className="w-10">
        {member.isOwner ? null : (
          <input
            type="checkbox"
            data-org-select={member.userId}
            className="size-4 accent-[var(--foreground)]"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={t('members.select', { name: memberLabel(member) })}
          />
        )}
      </Td>
      <Td>
        <div className="max-w-40 truncate font-medium text-foreground" title={member.displayName}>
          {member.displayName || '—'}
        </div>
      </Td>
      <Td>
        <div className="max-w-64 truncate text-foreground" title={member.email}>
          {member.email}
        </div>
        {member.username ? (
          <div className="max-w-64 truncate text-xs text-subtle-foreground" title={member.username}>
            {member.username}
          </div>
        ) : null}
      </Td>
      <Td>
        {member.isOwner ? (
          <Badge tone="info">{t('owner')}</Badge>
        ) : (
          <Badge tone={active ? 'success' : 'warning'} data-org-member-status={member.status}>
            {t(`members.status.${member.status}`)}
          </Badge>
        )}
      </Td>
      <Td>{quota}</Td>
      <Td className="whitespace-nowrap tabular-nums">
        {member.isOwner ? NONE : formatUsd(member.spendingUsed)}
      </Td>
      <Td className="whitespace-nowrap tabular-nums">
        {member.isOwner ? (
          NONE
        ) : (
          <>
            <div
              className={cn(
                isExhausted(member) ? 'font-medium text-warning' : 'text-foreground',
                member.spendingRemaining === null && 'text-muted-foreground',
              )}
            >
              {member.spendingRemaining === null
                ? t('members.unlimited')
                : formatUsd(member.spendingRemaining)}
            </div>
            {member.quota?.mode === 'periodic_active' && member.quota.windowEnd ? (
              <div className="text-xs text-subtle-foreground">
                {t('members.resetAt', { date: minuteOf(member.quota.windowEnd) })}
              </div>
            ) : null}
            {member.spendingFrozen > 0 ? (
              <div className="text-xs text-subtle-foreground">
                {t('members.frozen', { amount: formatUsd(member.spendingFrozen) })}
              </div>
            ) : null}
          </>
        )}
      </Td>
      <Td sticky="right">
        <div className="flex items-center justify-end gap-1">
          <OrgIconButton
            icon={Pencil}
            label={t('members.actions.rename')}
            data-org-rename
            onClick={onRename}
          />
          {member.isOwner ? null : (
            <>
              <OrgIconButton
                icon={Wallet}
                label={t('members.actions.quota')}
                data-org-quota
                onClick={onQuota}
              />
              <OrgIconButton
                icon={active ? Ban : CircleCheck}
                label={active ? t('members.actions.disable') : t('members.actions.enable')}
                tone={active ? 'danger' : 'success'}
                data-org-toggle
                disabled={busy}
                onClick={onToggleStatus}
              />
            </>
          )}
        </div>
      </Td>
    </Tr>
  );
}
