'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { RateBadge } from '@/components/console/group-rate';
import { InfoPopover } from '@/components/console/info-popover';
import { Badge } from '@/components/ui/badge';
import { formatUsd } from '@/lib/console';
import type { LogRow } from '@/lib/console/live/logs-types';
import {
  costBreakdown,
  formatPerMillion,
  formatPreciseUsd,
  type CostTier,
  type CostValue,
} from '@/lib/console/live/logs-view';

/** 明细里的一行：左边名称，右边数值 */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <dt className="text-subtle-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{children}</dd>
    </div>
  );
}

function TierValue({ tier }: { tier: CostTier }) {
  const t = useTranslations('consoleLogs');
  if (tier.kind === 'raw') return tier.value;
  const label = t(`cost.tier.${tier.tier}`);
  // Fast 档默认按两倍计费，和模型名旁的 Fast 标签同一个颜色
  return tier.tier === 'fast' || tier.tier === 'ultrafast' ? (
    <Badge tone="warning">{label}</Badge>
  ) : (
    label
  );
}

/**
 * 费用明细卡片：内容和 sub2api 使用记录里费用旁的悬浮明细一致（用户 2026-10-04 要求），样式用控制台的卡片。
 * 上半是分项费用、单价（生图是张数、尺寸与单张价格），下半是服务档位、倍率、原始与用户扣费。
 */
function CostDetails({ row }: { row: LogRow }) {
  const t = useTranslations('consoleLogs');
  const breakdown = costBreakdown(row);
  const text = (value: CostValue): string => {
    switch (value.type) {
      case 'usd':
        return formatPreciseUsd(value.amount);
      case 'perMillion':
        return t('cost.perMillion', { price: formatPerMillion(value.amount) });
      case 'images':
        return t('cost.imageCountValue', { count: value.count });
      case 'text':
        return value.text;
      case 'note':
        return t(`cost.note.${value.note}`);
      case 'legacySize':
        return t('cost.legacySize', { size: value.size });
    }
  };

  return (
    <div data-cost-details={row.id} className="min-w-56 whitespace-nowrap text-xs">
      <p className="font-semibold text-foreground">{t('cost.details')}</p>
      {breakdown.lines.length > 0 ? (
        <dl className="mt-2 space-y-1.5">
          {breakdown.lines.map((line) => (
            <Line key={line.key} label={t(`cost.${line.key}`)}>
              {text(line.value)}
            </Line>
          ))}
        </dl>
      ) : null}
      <dl className="mt-3 space-y-1.5 border-t border-border pt-3">
        <Line label={t('cost.serviceTier')}>
          <TierValue tier={breakdown.tier} />
        </Line>
        <Line label={t('cost.rate')}>
          <RateBadge rate={breakdown.rate} />
        </Line>
        <Line label={t('cost.original')}>{formatPreciseUsd(breakdown.original)}</Line>
        <Line label={t('cost.billed')}>
          <span className="font-semibold">{formatPreciseUsd(breakdown.billed)}</span>
        </Line>
      </dl>
    </div>
  );
}

/** 表格的费用格：实际扣费，后面一个「i」图标，悬停（或点一下）看费用明细 */
export function CostCell({ row }: { row: LogRow }) {
  const t = useTranslations('consoleLogs');
  return (
    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
      <span className="font-medium tabular-nums">{formatUsd(row.actualCost)}</span>
      <InfoPopover name={`cost-${row.id}`} label={t('cost.open')}>
        <CostDetails row={row} />
      </InfoPopover>
    </div>
  );
}
