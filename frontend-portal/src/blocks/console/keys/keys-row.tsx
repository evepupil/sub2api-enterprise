'use client';

import { Pause, Pencil, Play, Terminal, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Td, Tr } from '@/components/console/data-table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/console/button';
import type { AppLocale } from '@/i18n/routing';
import { formatInteger, formatUsd, type KeyStatus } from '@/lib/console';

import { KeysIconButton, KeysQuotaCell, KeysSecretCell } from './keys-cells';
import { groupLabel, type KeyRow } from './keys-model';

/** 启用绿色，暂停黄色，过期灰色（过期是正常结束，不算故障，不用红色） */
const STATUS_TONE: Record<KeyStatus, BadgeTone> = {
  active: 'success',
  paused: 'warning',
  expired: 'neutral',
};

export interface KeysRowHandlers {
  onToggleReveal: () => void;
  onConnect: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

/** 密钥表的一行：名称、密钥、分组、状态、用量、额度、有效期，最右一列固定放操作 */
export function KeysRow({
  row,
  revealed,
  onToggleReveal,
  onConnect,
  onEdit,
  onToggleStatus,
  onDelete,
}: KeysRowHandlers & { row: KeyRow; revealed: boolean }) {
  const t = useTranslations('consoleKeys');
  const locale = useLocale() as AppLocale;
  const active = row.status === 'active';
  const expired = row.status === 'expired';
  const toggleLabel = active ? t('actions.pause') : t('actions.resume');

  return (
    <Tr data-key-row={row.id}>
      <Td>
        <div className="max-w-48 truncate font-medium text-foreground" title={row.name}>
          {row.name}
        </div>
        <div className="mt-0.5 whitespace-nowrap text-xs text-subtle-foreground">
          {t('table.createdOn', { date: row.createdAt })}
        </div>
      </Td>
      <Td>
        <KeysSecretCell row={row} revealed={revealed} onToggleReveal={onToggleReveal} />
      </Td>
      <Td>
        <Badge tone="outline">{groupLabel(row.group, locale)}</Badge>
      </Td>
      <Td>
        <Badge tone={STATUS_TONE[row.status]} data-key-status={row.status}>
          {t(`status.${row.status}`)}
        </Badge>
      </Td>
      <Td>
        <div className="space-y-0.5 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          <p>
            {t('table.usageLast30', {
              count: row.usage.last30.requests,
              requests: formatInteger(row.usage.last30.requests),
              cost: formatUsd(row.usage.last30.costUsd),
            })}
          </p>
          <p>
            {t('table.usageToday', {
              count: row.usage.today.requests,
              requests: formatInteger(row.usage.today.requests),
              cost: formatUsd(row.usage.today.costUsd),
            })}
          </p>
        </div>
      </Td>
      <Td>
        <KeysQuotaCell row={row} />
      </Td>
      <Td className="whitespace-nowrap tabular-nums">
        {row.expiresAt === null ? (
          <span className="text-muted-foreground">{t('table.permanent')}</span>
        ) : (
          <span className={expired ? 'text-danger' : 'text-foreground'}>{row.expiresAt}</span>
        )}
      </Td>
      <Td sticky="right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="secondary" size="sm" data-key-usage={row.id} onClick={onConnect}>
            <Terminal aria-hidden />
            {t('actions.connect')}
          </Button>
          <KeysIconButton icon={Pencil} label={t('actions.edit')} data-key-edit onClick={onEdit} />
          <KeysIconButton
            icon={active ? Pause : Play}
            label={toggleLabel}
            data-key-toggle
            disabled={expired}
            onClick={onToggleStatus}
          />
          <KeysIconButton
            icon={Trash2}
            tone="danger"
            label={t('actions.delete')}
            data-key-delete
            onClick={onDelete}
          />
        </div>
      </Td>
    </Tr>
  );
}
