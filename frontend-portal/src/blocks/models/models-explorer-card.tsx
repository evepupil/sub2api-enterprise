'use client';

/**
 * 模型卡：某个分组里的一个模型（数据来自后台，见 src/lib/catalog/live.ts）。价格、折扣标、可用率都是这个分组的，
 * 分组名写在价格上面。复制调用名成功后短暂换成对勾，1.5 秒恢复。
 */

import { useEffect, useRef, useState } from 'react';

import { ArrowRight, Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DiscountBadge } from '@/components/catalog/discount-badge';
import { ProviderLogo } from '@/components/catalog/provider-logo';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { formatContext, formatMoney, getProvider } from '@/lib/catalog';
import { priceRowId, type SiteModel } from '@/lib/catalog/live';

import { ModelsHealth } from './models-health';

function CardPrice({ model }: { model: SiteModel }) {
  const t = useTranslations('models');
  const tc = useTranslations('common');
  const { price } = model;

  let label: string;
  let value: React.ReactNode;
  if (price.kind === 'token') {
    label = t('card.inputOutput');
    const input = price.input === null ? '—' : formatMoney(price.input);
    const output = price.output === null ? '—' : formatMoney(price.output);
    value = (
      <>
        {input} / {output}
        <span className="text-xs font-normal text-subtle-foreground">
          {' '}
          {tc('units.perMTokens')}
        </span>
      </>
    );
  } else if (price.kind === 'request') {
    label = price.unit === 'image' ? t('card.perImage') : t('card.perRequest');
    value = `${formatMoney(price.price)}${price.from ? ` ${tc('units.from')}` : ''}`;
  } else {
    return null;
  }

  return (
    <>
      <p className="mt-1 text-xs text-subtle-foreground">{label}</p>
      <p data-card-price className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
        {value}
      </p>
    </>
  );
}

export function ModelsExplorerCard({ model, locale }: { model: SiteModel; locale: AppLocale }) {
  const t = useTranslations('models');

  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // 卸载时清掉恢复图标的定时器，避免对已卸载的组件 setState
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const copyId = () => {
    // 可选链：clipboard 不存在（非安全上下文）时整条链路静默跳过；写入失败也不提示
    navigator.clipboard
      ?.writeText(model.id)
      .then(() => {
        setCopied(true);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <article
      data-model-card={model.id}
      data-group={model.group.name}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="flex min-h-5 items-center gap-2">
        {model.provider ? (
          <>
            <ProviderLogo provider={model.provider} size={18} />
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {getProvider(model.provider).name}
            </span>
          </>
        ) : null}
        {model.isNew ? <Badge tone="info">{t('card.new')}</Badge> : null}
        <span className="flex-1" />
        {model.type === 'image' ? <Badge tone="outline">{t('card.image')}</Badge> : null}
      </div>

      <h3 className="mt-3 truncate text-base font-semibold text-foreground" title={model.name}>
        {model.name}
      </h3>

      <div className="mt-1 flex items-center gap-1.5">
        <code className="min-w-0 truncate font-mono text-xs text-subtle-foreground">
          {model.id}
        </code>
        <button
          type="button"
          data-copy-id={model.id}
          aria-label={t('card.copy')}
          onClick={copyId}
          className="shrink-0 rounded p-1 text-subtle-foreground hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <Check aria-hidden className="size-3.5 text-success" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
        </button>
      </div>

      {model.health ? <ModelsHealth health={model.health} /> : null}

      <div className="mt-auto pt-4">
        <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
          <div className="min-w-0">
            <p
              data-card-group
              className="truncate text-xs font-medium text-foreground"
              title={model.group.name}
            >
              {model.group.name}
            </p>
            <CardPrice model={model} />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <DiscountBadge discount={model.discount} locale={locale} />
            {model.contextTokens !== null ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatContext(model.contextTokens)} {t('card.context')}
              </span>
            ) : null}
          </div>
        </div>

        <Link
          href={{ pathname: '/pricing', hash: priceRowId(model) }}
          data-card-pricing
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
        >
          {t('card.pricing')}
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

export default ModelsExplorerCard;
