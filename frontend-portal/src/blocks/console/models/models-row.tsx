'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ProviderLogo } from '@/components/catalog/provider-logo';
import { buttonClass } from '@/components/console/button';
import { Td, Tr } from '@/components/console/data-table';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { PROTOCOL_LABELS, formatContext, getProvider } from '@/lib/catalog';
import type { LiveCurrency, ModelRowView } from '@/lib/console/live/models-view';
import { cn } from '@/lib/utils';

import { ChannelCell } from './models-channel';
import { ModelDiscount, ModelPrice } from './models-price';

/**
 * 模型表的一行：一个通道里的一个模型（同一个模型在几个通道里就有几行）。
 * 第一列（模型）和最后一列（操作）固定，横向滚动时始终看得见；
 * 手机宽度下第一列不固定，否则它一列就占满屏幕，其余列没法看。
 * 单元格内容一律不换行（whitespace-nowrap），宽度不够时由表格整体横向滚动。
 * 官网目录里没有的模型：没有厂商标志、协议列「—」、上下文「—」。
 */
export function ModelRow({
  row,
  currency,
  rechargeMultiplier,
  locale,
  favorite,
  onToggleFavorite,
}: {
  row: ModelRowView;
  currency: LiveCurrency;
  rechargeMultiplier: number;
  locale: AppLocale;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const t = useTranslations('consoleModels');

  return (
    <Tr data-model-row={row.key}>
      <Td sticky="left" className="min-w-60 whitespace-nowrap max-sm:static">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-favorite={row.id}
            aria-pressed={favorite}
            aria-label={favorite ? t('table.unfavorite') : t('table.favorite')}
            onClick={() => onToggleFavorite(row.id)}
            className="shrink-0 rounded-md p-1.5 text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Star
              aria-hidden
              className={cn('size-4', favorite && 'fill-current text-warning-graphic')}
            />
          </button>
          {row.provider ? (
            <ProviderLogo provider={row.provider} size={18} />
          ) : (
            <span aria-hidden className="size-[18px] shrink-0 rounded-full bg-muted" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-foreground">{row.name}</span>
              {row.isNew ? <Badge tone="info">{t('table.new')}</Badge> : null}
            </div>
            {row.name !== row.id ? (
              <p className="font-mono text-xs text-subtle-foreground">{row.id}</p>
            ) : null}
          </div>
        </div>
      </Td>

      <Td>
        <ChannelCell channel={row.channel} />
      </Td>

      <Td align="right" className="whitespace-nowrap">
        <ModelPrice row={row} currency={currency} rechargeMultiplier={rechargeMultiplier} />
      </Td>

      <Td className="whitespace-nowrap">
        <ModelDiscount
          row={row}
          currency={currency}
          rechargeMultiplier={rechargeMultiplier}
          locale={locale}
        />
      </Td>

      <Td>
        <Badge tone="outline">{row.type === 'text' ? t('filters.text') : t('filters.image')}</Badge>
      </Td>

      <Td className="whitespace-nowrap">{row.provider ? getProvider(row.provider).name : '—'}</Td>

      <Td>
        {row.protocols.length > 0 ? (
          <div className="flex flex-col items-start gap-1">
            {row.protocols.map((protocol) => (
              <Badge key={protocol} tone="outline" className="font-mono text-[11px]">
                {PROTOCOL_LABELS[protocol]}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-subtle-foreground">—</span>
        )}
      </Td>

      <Td className="whitespace-nowrap tabular-nums">
        {row.contextTokens === null ? '—' : formatContext(row.contextTokens)}
      </Td>

      <Td sticky="right" className="whitespace-nowrap">
        {row.type === 'text' ? (
          <Link
            href={{ pathname: '/console/chat', query: { model: row.id } }}
            className={buttonClass({ size: 'sm' })}
            data-try={row.id}
          >
            {t('table.try')}
          </Link>
        ) : (
          <span className="text-subtle-foreground">—</span>
        )}
      </Td>
    </Tr>
  );
}
