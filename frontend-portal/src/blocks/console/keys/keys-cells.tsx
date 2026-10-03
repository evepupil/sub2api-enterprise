'use client';

import { Eye, EyeOff, Infinity as InfinityIcon, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ButtonHTMLAttributes } from 'react';

import { CopyButton } from '@/components/console/copy-button';
import { formatUsd, maskKey } from '@/lib/console';
import { cn } from '@/lib/utils';

import { keyQuotaRatio, type KeyRow } from './keys-model';

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
  row: KeyRow;
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

const QUOTA_FILL = { ok: 'bg-primary', full: 'bg-danger-graphic' } as const;

/** 额度列：不限额显示无穷符号；有上限显示「已用 / 上限」和一条进度条，用满变红 */
export function KeysQuotaCell({ row }: { row: KeyRow }) {
  const t = useTranslations('consoleKeys');
  const ratio = keyQuotaRatio(row);
  if (ratio === null || row.quotaUsd === null) {
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
        {formatUsd(row.usage.totalCostUsd)} / {formatUsd(row.quotaUsd)}
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
