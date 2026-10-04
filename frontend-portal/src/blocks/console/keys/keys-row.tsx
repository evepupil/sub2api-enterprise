'use client';

import { Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Td, Tr } from '@/components/console/data-table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { KeyStatus, LiveKey } from '@/lib/console/live/keys-types';

import {
  KeysExpiryCell,
  KeysGroupCell,
  KeysIconButton,
  KeysQuotaCell,
  KeysSecretCell,
  KeysUsageCell,
} from './keys-cells';
import { consoleDate } from './keys-model';

/** 启用绿色，暂停黄色，额度用完红色（要处理才能再用），过期灰色（正常结束，不算故障） */
const STATUS_TONE: Record<KeyStatus, BadgeTone> = {
  active: 'success',
  inactive: 'warning',
  quota_exhausted: 'danger',
  expired: 'neutral',
};

export interface KeysRowHandlers {
  onToggleReveal: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

/**
 * 密钥表的一行：名称（下一行创建日期）、密钥、分组、状态、用量、额度、有效期，最右一列固定放操作。
 * 暂停 / 启用只在启用、已暂停两种状态之间切换；额度用完、已过期的要在编辑里加额度或延期（后端会自动恢复）。
 */
export function KeysRow({
  row,
  revealed,
  busy,
  onToggleReveal,
  onEdit,
  onToggleStatus,
  onDelete,
}: KeysRowHandlers & { row: LiveKey; revealed: boolean; busy: boolean }) {
  const t = useTranslations('consoleKeys');
  const active = row.status === 'active';
  const toggleable = active || row.status === 'inactive';

  return (
    <Tr data-key-row={row.id}>
      <Td>
        <div className="max-w-48 truncate font-medium text-foreground" title={row.name}>
          {row.name}
        </div>
        <div className="mt-0.5 whitespace-nowrap text-xs text-subtle-foreground">
          {t('table.createdOn', { date: consoleDate(row.createdAt) })}
        </div>
      </Td>
      <Td>
        <KeysSecretCell row={row} revealed={revealed} onToggleReveal={onToggleReveal} />
      </Td>
      <Td>
        <KeysGroupCell row={row} />
      </Td>
      <Td>
        <Badge tone={STATUS_TONE[row.status]} data-key-status={row.status}>
          {t(`status.${row.status}`)}
        </Badge>
      </Td>
      <Td>
        <KeysUsageCell row={row} />
      </Td>
      <Td>
        <KeysQuotaCell row={row} />
      </Td>
      <Td className="whitespace-nowrap tabular-nums">
        <KeysExpiryCell row={row} />
      </Td>
      <Td sticky="right">
        <div className="flex items-center justify-end gap-1">
          <KeysIconButton icon={Pencil} label={t('actions.edit')} data-key-edit onClick={onEdit} />
          <KeysIconButton
            icon={active ? Pause : Play}
            label={active ? t('actions.pause') : t('actions.resume')}
            data-key-toggle
            disabled={!toggleable || busy}
            onClick={onToggleStatus}
          />
          <KeysIconButton
            icon={Trash2}
            tone="danger"
            label={t('actions.delete')}
            data-key-delete
            disabled={busy}
            onClick={onDelete}
          />
        </div>
      </Td>
    </Tr>
  );
}
