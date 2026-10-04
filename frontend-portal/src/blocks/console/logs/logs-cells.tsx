'use client';

import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { GroupWithRate } from '@/components/console/group-rate';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { formatDuration, formatInteger } from '@/lib/console';
import type { LogRow } from '@/lib/console/live/logs-types';
import {
  formatUnitPrice,
  logExtras,
  outputSpeed,
  tierOf,
  unitPrices,
  type LogExtra,
  type TierKey,
} from '@/lib/console/live/logs-view';

/**
 * 日志表里信息多的几格：密钥（含分组与倍率）、Token、耗时、计费。
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

const TIER_TONE: Record<TierKey, BadgeTone> = {
  standard: 'outline',
  priority: 'info',
  flex: 'neutral',
};

/** 第一行计费档，后面「+N」把长上下文计价、推理强度、生图张数收起来（悬停看全部）；第二行官方价单价 */
export function BillingCell({ row }: { row: LogRow }) {
  const t = useTranslations('consoleLogs');
  const tier = tierOf(row.serviceTier);
  const prices = unitPrices(row);
  const extras = logExtras(row).map((extra: LogExtra) => {
    if (extra.kind === 'longContext') return t('table.extra.longContext');
    if (extra.kind === 'reasoning') return t('table.extra.reasoning', { value: extra.value });
    return extra.size
      ? t('table.extra.imagesWithSize', { count: extra.count, size: extra.size })
      : t('table.extra.images', { count: extra.count });
  });
  return (
    <div className="space-y-1 whitespace-nowrap">
      <div className="flex items-center gap-1.5">
        <Badge tone={tier ? TIER_TONE[tier] : 'outline'}>
          {tier ? t(`table.tier.${tier}`) : row.serviceTier}
        </Badge>
        {extras.length > 0 ? (
          <Badge tone="neutral" title={extras.join('；')} data-log-extras={extras.length}>
            {t('table.moreCount', { count: extras.length })}
            <span className="sr-only">{extras.join('；')}</span>
          </Badge>
        ) : null}
      </div>
      {prices.input !== null || prices.output !== null ? (
        <div className="text-xs tabular-nums text-subtle-foreground">
          {t('table.unitPrice', {
            input: formatUnitPrice(prices.input),
            output: formatUnitPrice(prices.output),
          })}
        </div>
      ) : null}
    </div>
  );
}
