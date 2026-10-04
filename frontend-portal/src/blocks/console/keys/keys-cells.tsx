'use client';

import { Eye, EyeOff, Infinity as InfinityIcon, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ButtonHTMLAttributes } from 'react';

import { CopyButton } from '@/components/console/copy-button';
import { GroupWithRate } from '@/components/console/group-rate';
import { formatInteger, formatUsd, maskKey } from '@/lib/console';
import type { LiveKey } from '@/lib/console/live/keys-types';
import { cn } from '@/lib/utils';

import { consoleDate, quotaRatio } from './keys-model';

/**
 * 密钥表里的几格：图标按钮、密钥（打码 / 显示 / 复制）、分组、用量、额度、有效期。
 */

const ICON_BUTTON_TONES = {
  default: 'text-subtle-foreground hover:bg-muted hover:text-foreground',
  danger: 'text-subtle-foreground hover:bg-danger-soft hover:text-danger',
} as const;

/** 表格里的图标按钮：固定 size-8，名称同时写进 aria-label 和 title */
export function KeysIconButton({
  icon: Icon,
  label,
  tone = 'default',
  className,
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
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

const SECRET_TEXT = {
  hidden: 'whitespace-nowrap',
  shown: 'max-w-60 break-all',
} as const;

/** 密钥列：默认打码，点眼睛显示完整密钥；复制按钮永远复制完整密钥 */
export function KeysSecretCell({
  row,
  revealed,
  onToggleReveal,
}: {
  row: LiveKey;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const t = useTranslations('consoleKeys');
  return (
    <div className="flex items-center gap-1">
      <span
        className={cn(
          'font-mono text-xs text-foreground',
          SECRET_TEXT[revealed ? 'shown' : 'hidden'],
        )}
      >
        {revealed ? row.secret : maskKey(row.secret)}
      </span>
      <KeysIconButton
        icon={revealed ? EyeOff : Eye}
        label={revealed ? t('actions.hide') : t('actions.reveal')}
        data-reveal={row.id}
        onClick={onToggleReveal}
      />
      <CopyButton name="key-secret" value={row.secret} label={t('actions.copySecret')} />
    </div>
  );
}

/** 分组列：分组名 + 倍率徽标（和模型页、日志页一样）；没有分组写「未分组」 */
export function KeysGroupCell({ row }: { row: LiveKey }) {
  const t = useTranslations('consoleKeys');
  if (row.group === null) {
    return <span className="text-subtle-foreground">{t('table.noGroup')}</span>;
  }
  return <GroupWithRate name={row.group.name} rate={row.group.rate} className="text-foreground" />;
}

/** 用量列：近 30 天、今天各一行（次数 · 花费）；用量统计读不到时写「—」 */
export function KeysUsageCell({ row }: { row: LiveKey }) {
  const t = useTranslations('consoleKeys');
  if (row.usage === null) return <span className="text-subtle-foreground">—</span>;
  const { last30, today } = row.usage;
  return (
    <div className="space-y-0.5 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
      <p>
        {t('table.usageLast30', {
          requests: formatInteger(last30.requests),
          cost: formatUsd(last30.costUsd),
        })}
      </p>
      <p>
        {t('table.usageToday', {
          requests: formatInteger(today.requests),
          cost: formatUsd(today.costUsd),
        })}
      </p>
    </div>
  );
}

const QUOTA_FILL = { ok: 'bg-primary', full: 'bg-danger-graphic' } as const;

/** 额度列：不限额显示无穷符号；有上限显示「已用 / 上限」和一条进度条，用满变红 */
export function KeysQuotaCell({ row }: { row: LiveKey }) {
  const t = useTranslations('consoleKeys');
  const ratio = quotaRatio(row);
  if (ratio === null) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
        <InfinityIcon aria-hidden className="size-4" />
        {t('table.unlimited')}
      </span>
    );
  }
  return (
    <div className="w-36">
      <p className="whitespace-nowrap text-xs tabular-nums text-foreground">
        {formatUsd(row.quotaUsed)} / {formatUsd(row.quota)}
      </p>
      {/* 数字已经写在上面，进度条只是辅助，读屏软件不用再读一遍 */}
      <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', QUOTA_FILL[ratio >= 1 ? 'full' : 'ok'])}
          style={{ width: `${Math.round(ratio * 1000) / 10}%` }}
        />
      </div>
    </div>
  );
}

/** 有效期列：到期日（北京时间），永久的写「永久」，已过期的标红 */
export function KeysExpiryCell({ row }: { row: LiveKey }) {
  const t = useTranslations('consoleKeys');
  if (row.expiresAt === null) {
    return <span className="text-muted-foreground">{t('table.permanent')}</span>;
  }
  return (
    <span className={row.status === 'expired' ? 'text-danger' : 'text-foreground'}>
      {consoleDate(row.expiresAt)}
    </span>
  );
}
