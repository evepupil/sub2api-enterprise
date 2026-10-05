'use client';

import { Fragment } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { DiscountBadge } from '@/components/catalog/discount-badge';
import { Badge } from '@/components/ui/badge';
import { formatMoney, IMAGE_TOKENS_PER_IMAGE } from '@/lib/catalog';
import { groupSiteModels, type SiteModel } from '@/lib/catalog/live';
import { useCurrency } from '@/lib/use-catalog-state';

import { PriceProviderRow } from './pricing-provider-row';

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** 模型格：名称、折扣标、「新」标、调用名。 */
function ImageModelCell({ model }: { model: SiteModel }) {
  const t = useTranslations('pricing');
  const locale = useLocale();
  return (
    <td className="px-5 py-4 align-top">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{model.name}</span>
        <DiscountBadge discount={model.discount} locale={locale} />
        {model.isNew ? <Badge tone="info">{t('tables.new')}</Badge> : null}
      </div>
      {/* 官网目录里没有的模型名字就是调用名，不重复写 */}
      {model.name === model.id ? null : (
        <p className="mt-1 font-mono text-xs text-subtle-foreground">{model.id}</p>
      )}
    </td>
  );
}

/** 价格格：按张写每张价（分辨率有多档时写「起」）；按 Token 写每百万输出 Token 单价加每张估算。 */
function ImagePriceCell({ model }: { model: SiteModel }) {
  const c = useTranslations('common');
  const [currency] = useCurrency();
  const { price } = model;
  const cell = 'px-5 py-4 text-right align-top tabular-nums text-foreground';

  if (price.kind === 'request') {
    return (
      <td data-cell="price" className={cell}>
        <div className="flex items-baseline justify-end gap-2">
          <span>{formatMoney(price.price, currency)}</span>
          <span className="text-subtle-foreground">
            {price.unit === 'image' ? c('units.perImage') : c('units.perRequest')}
            {price.from ? ` ${c('units.from')}` : ''}
          </span>
        </div>
      </td>
    );
  }
  if (price.kind === 'token' && price.output !== null) {
    return (
      <td data-cell="price" className={cell}>
        <div className="flex items-baseline justify-end gap-2">
          <span>{formatMoney(price.output, currency)}</span>
          <span className="text-subtle-foreground">{c('units.perMTokens')}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {c('units.approx')}{' '}
          {formatMoney(round6((price.output * IMAGE_TOKENS_PER_IMAGE) / 1_000_000), currency)}{' '}
          {c('units.perImage')}
        </div>
      </td>
    );
  }
  return (
    <td data-cell="price" className={cell}>
      —
    </td>
  );
}

/** 模型行：计费方式与价格都按所选通道的实付价（来自后台）。 */
function ImageModelRow({ model }: { model: SiteModel }) {
  const t = useTranslations('pricing');
  const { price } = model;
  let billing = '—';
  if (price.kind === 'request') {
    billing = price.unit === 'image' ? t('tables.perImageBilling') : t('tables.perRequestBilling');
  } else if (price.kind === 'token') {
    billing = t('tables.perTokenBilling');
  }

  return (
    <tr
      id={`model-${model.id}`}
      data-price-row={model.id}
      className="scroll-mt-28 border-t border-border transition-colors hover:bg-muted/40 target:bg-info-soft"
    >
      <ImageModelCell model={model} />
      <td className="px-5 py-4 align-top text-muted-foreground">{billing}</td>
      <ImagePriceCell model={model} />
    </tr>
  );
}

/** 生图模型价目表：按厂商分段，三列分别是模型、计费方式、价格。 */
export function ImagePriceTable({ models }: { models: readonly SiteModel[] }) {
  const t = useTranslations('pricing');
  const sections = groupSiteModels(models);

  return (
    <div id="image-models" className="scroll-mt-28">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-2xl font-medium tracking-tight text-foreground">
          {t('tables.imageTitle')}
        </h2>
        <p className="text-xs text-subtle-foreground">{t('tables.imageUnit')}</p>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table data-price-table="image" className="w-full min-w-[680px] border-collapse text-sm">
            <thead className="bg-surface">
              <tr>
                <th
                  scope="col"
                  className="px-5 py-3 text-left text-xs font-medium text-subtle-foreground"
                >
                  {t('tables.model')}
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-left text-xs font-medium text-subtle-foreground"
                >
                  {t('tables.billing')}
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-right text-xs font-medium text-subtle-foreground"
                >
                  {t('tables.price')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <Fragment key={section.provider ?? 'other'}>
                  <PriceProviderRow provider={section.provider} colSpan={3} />
                  {section.models.map((model) => (
                    <ImageModelRow key={model.id} model={model} />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
