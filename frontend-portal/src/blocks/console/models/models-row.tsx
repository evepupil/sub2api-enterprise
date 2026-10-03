'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ProviderLogo } from '@/components/catalog/provider-logo';
import { Td, Tr } from '@/components/console/data-table';
import { Badge } from '@/components/ui/badge';
import { buttonClass } from '@/components/ui/button-styles';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import {
  PROTOCOL_LABELS,
  formatContext,
  getProvider,
  isNewModel,
  type Currency,
  type EditionId,
  type Model,
} from '@/lib/catalog';
import { cn } from '@/lib/utils';

import { ModelDiscount, ModelPrice } from './models-price';

/**
 * 模型表的一行。第一列（模型）和最后一列（操作）固定，横向滚动时始终看得见；
 * 手机宽度下第一列不固定，否则它一列就占满屏幕，其余列没法看。
 * 单元格内容一律不换行（whitespace-nowrap），宽度不够时由表格整体横向滚动。
 */
export function ModelRow({
  model,
  group,
  currency,
  locale,
  favorite,
  onToggleFavorite,
}: {
  model: Model;
  group: EditionId;
  currency: Currency;
  locale: AppLocale;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const t = useTranslations('consoleModels');

  return (
    <Tr>
      <Td sticky="left" className="min-w-60 whitespace-nowrap max-sm:static">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-favorite={model.id}
            aria-pressed={favorite}
            aria-label={favorite ? t('table.unfavorite') : t('table.favorite')}
            onClick={() => onToggleFavorite(model.id)}
            className="shrink-0 rounded-md p-1.5 text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Star
              aria-hidden
              className={cn('size-4', favorite && 'fill-current text-warning-graphic')}
            />
          </button>
          <ProviderLogo provider={model.provider} size={18} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{model.name}</span>
              {isNewModel(model) ? <Badge tone="info">{t('table.new')}</Badge> : null}
            </div>
            <p className="font-mono text-xs text-subtle-foreground">{model.id}</p>
          </div>
        </div>
      </Td>

      <Td align="right" className="whitespace-nowrap">
        <ModelPrice model={model} group={group} currency={currency} />
      </Td>

      <Td className="whitespace-nowrap">
        <ModelDiscount model={model} group={group} currency={currency} locale={locale} />
      </Td>

      <Td>
        <Badge tone="outline">
          {model.type === 'text' ? t('filters.text') : t('filters.image')}
        </Badge>
      </Td>

      <Td className="whitespace-nowrap">{getProvider(model.provider).name}</Td>

      <Td>
        <div className="flex flex-col items-start gap-1">
          {model.protocols.map((protocol) => (
            <Badge key={protocol} tone="outline" className="font-mono text-[11px]">
              {PROTOCOL_LABELS[protocol]}
            </Badge>
          ))}
        </div>
      </Td>

      <Td className="whitespace-nowrap tabular-nums">
        {model.contextTokens === null ? '—' : formatContext(model.contextTokens)}
      </Td>

      <Td sticky="right" className="whitespace-nowrap">
        {model.type === 'text' ? (
          <Link
            href={{ pathname: '/console/chat', query: { model: model.id } }}
            className={buttonClass({ size: 'sm' })}
            data-try={model.id}
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
