'use client';

import { Gauge, Pause, Play, Trash2, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ButtonHTMLAttributes } from 'react';

import { Td, Tr } from '@/components/console/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/console/button';
import type { AppLocale } from '@/i18n/routing';
import { formatUsd, quotaRatio, type OrgMember } from '@/lib/console';
import { cn } from '@/lib/utils';

import { isAdmin, memberInitial, quotaLevel, type QuotaLevel } from './organization-model';

const ICON_BUTTON_TONES = {
  default: 'text-subtle-foreground hover:bg-muted hover:text-foreground',
  danger: 'text-subtle-foreground hover:bg-danger-soft hover:text-danger',
} as const;

/** 操作列的图标按钮：固定 size-8，名称同时写进 aria-label 和 title */
function MemberIconButton({
  icon: Icon,
  label,
  tone = 'default',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  tone?: keyof typeof ICON_BUTTON_TONES;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40',
        ICON_BUTTON_TONES[tone],
      )}
      {...rest}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

const QUOTA_FILL: Record<QuotaLevel, string> = {
  ok: 'bg-primary',
  warning: 'bg-warning-graphic',
  full: 'bg-danger-graphic',
};

/** 本月配额列：不限额只写「不限」；有上限显示「已用 / 上限」和进度条，用满标「已用完」 */
function MemberQuotaCell({ member }: { member: OrgMember }) {
  const t = useTranslations('consoleOrg');
  const ratio = quotaRatio(member);
  if (ratio === null || member.quotaUsd === null) {
    return <span className="text-muted-foreground">{t('members.unlimited')}</span>;
  }
  const level = quotaLevel(ratio);
  return (
    <div className="w-40">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-xs tabular-nums text-foreground">
          {formatUsd(member.usedUsd)} / {formatUsd(member.quotaUsd)}
        </span>
        {level === 'full' ? <Badge tone="danger">{t('members.exhausted')}</Badge> : null}
      </div>
      {/* 数字已经写在上面，进度条只是辅助，读屏软件不用再读一遍 */}
      <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', QUOTA_FILL[level])}
          style={{ width: `${Math.round(ratio * 1000) / 10}%` }}
        />
      </div>
    </div>
  );
}

/**
 * 成员表的一行。管理员本人那行只能调整配额，停用和移除按钮禁用。
 */
export function OrganizationMemberRow({
  member,
  onAdjustQuota,
  onToggle,
  onRemove,
}: {
  member: OrgMember;
  onAdjustQuota: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('consoleOrg');
  const locale = useLocale() as AppLocale;
  const name = member.name[locale];
  const admin = isAdmin(member);
  const active = member.status === 'active';

  return (
    <Tr data-member-row={member.id}>
      <Td>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
          >
            {memberInitial(name)}
          </span>
          <div className="min-w-0">
            <div className="max-w-48 truncate font-medium text-foreground" title={name}>
              {name}
            </div>
            <div className="max-w-48 truncate text-xs text-subtle-foreground" title={member.email}>
              {member.email}
            </div>
          </div>
        </div>
      </Td>
      <Td>
        <Badge tone={admin ? 'dark' : 'outline'}>{t(`roles.${member.role}`)}</Badge>
      </Td>
      <Td>
        <MemberQuotaCell member={member} />
      </Td>
      <Td className="tabular-nums">{member.keys}</Td>
      <Td>
        <Badge tone={active ? 'success' : 'neutral'}>{t(`members.status.${member.status}`)}</Badge>
      </Td>
      <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{member.joinedAt}</Td>
      <Td sticky="right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="secondary" size="sm" data-member-quota onClick={onAdjustQuota}>
            <Gauge aria-hidden />
            {t('actions.adjustQuota')}
          </Button>
          <MemberIconButton
            icon={active ? Pause : Play}
            label={active ? t('actions.disable') : t('actions.enable')}
            data-member-toggle
            disabled={admin}
            onClick={onToggle}
          />
          <MemberIconButton
            icon={Trash2}
            tone="danger"
            label={t('actions.remove')}
            data-member-remove
            disabled={admin}
            onClick={onRemove}
          />
        </div>
      </Td>
    </Tr>
  );
}
