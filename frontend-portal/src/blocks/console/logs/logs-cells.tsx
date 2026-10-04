'use client';

import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { GroupWithRate } from '@/components/console/group-rate';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { formatDuration, formatInteger } from '@/lib/console';
import type { LogRow } from '@/lib/console/live/logs-types';
import { fastModeOf, outputSpeed } from '@/lib/console/live/logs-view';

/**
 * 日志表里信息多的几格：密钥（含分组与倍率）、Token、耗时，以及模型名旁的 Fast 标签（费用格见 logs-cost）。
 * 每格第一行是主要信息，第二行小字补充；一律不换行，宽度不够时整表横向滚动。
 */

/** 密钥名 + 下一行「分组名 ×倍率」 */
export function KeyCell({ row }: { row: LogRow }) {
  const t = useTranslations('consoleLogs');
  return (
    <div className="min-w-0 space-y-1 whitespace-nowrap">
      <div className="flex items-center gap-1.5 text-foreground">
        <KeyRound aria-hidden className="size-3.5 shrink-0 text-subtle-foreground" />
        <span className="max-w-40 truncate" title={row.key.name}>
          {row.key.name}
        </span>
      </div>
      <GroupWithRate
        name={row.group?.name ?? t('table.noGroup')}
        rate={row.rate}
        className="text-xs text-subtle-foreground"
      />
    </div>
  );
}

/** 「输入 / 输出」+ 下一行缓存读写（有才写） */
export function TokensCell({ row }: { row: LogRow }) {
  const t = useTranslations('consoleLogs');
  const cache = [
    row.tokens.cacheRead > 0
      ? t('table.cacheRead', { count: formatInteger(row.tokens.cacheRead) })
      : null,
    row.tokens.cacheWrite > 0
      ? t('table.cacheWrite', { count: formatInteger(row.tokens.cacheWrite) })
      : null,
  ].filter((part): part is string => part !== null);
  return (
    <div className="whitespace-nowrap tabular-nums">
      <div className="text-foreground">
        {formatInteger(row.tokens.input)} / {formatInteger(row.tokens.output)}
      </div>
      {cache.length > 0 ? (
        <div className="text-xs text-subtle-foreground">{cache.join(' · ')}</div>
      ) : null}
    </div>
  );
}

/** 总耗时：5 秒内绿、15 秒内蓝、更久橙；首字：2 秒内绿、5 秒内蓝、更久橙 */
function totalTone(ms: number): BadgeTone {
  return ms < 5_000 ? 'success' : ms < 15_000 ? 'info' : 'warning';
}
function firstTokenTone(ms: number): BadgeTone {
  return ms < 2_000 ? 'success' : ms < 5_000 ? 'info' : 'warning';
}

/** 总耗时、首字两个徽标 + 下一行「流式 · 25 Token/s」 */
export function DurationCell({ row }: { row: LogRow }) {
  const t = useTranslations('consoleLogs');
  const speed = outputSpeed(row);
  const mode = row.stream ? t('table.stream') : t('table.nonStream');
  return (
    <div className="space-y-1 whitespace-nowrap tabular-nums">
      <div className="flex items-center gap-1.5">
        {row.durationMs === null ? (
          <span className="text-subtle-foreground">—</span>
        ) : (
          <Badge tone={totalTone(row.durationMs)}>{formatDuration(row.durationMs)}</Badge>
        )}
        {row.firstTokenMs !== null ? (
          <Badge tone={firstTokenTone(row.firstTokenMs)}>
            {t('table.firstToken', { value: formatDuration(row.firstTokenMs) })}
          </Badge>
        ) : null}
      </div>
      <div className="text-xs text-subtle-foreground">
        {speed === null ? mode : `${mode} · ${t('table.speed', { value: speed })}`}
      </div>
    </div>
  );
}

/** 开了 Fast（或 Ultrafast）的调用在模型名旁标一下：后端默认按两倍计费，客户能看出这条为什么贵 */
export function FastBadge({ serviceTier }: { serviceTier: string | null }) {
  const t = useTranslations('consoleLogs');
  const mode = fastModeOf(serviceTier);
  if (mode === null) return null;
  return (
    <Badge tone="warning" data-log-fast={mode}>
      {t(mode === 'fast' ? 'table.fast' : 'table.ultrafast')}
    </Badge>
  );
}
