'use client';

import { useLocale, useTranslations } from 'next-intl';

import { DiscountBadge } from '@/components/catalog/discount-badge';
import { ProviderLogo } from '@/components/catalog/provider-logo';
import { Badge } from '@/components/ui/badge';
import {
  editionDiscount,
  formatMoney,
  getProvider,
  groupByProvider,
  imagePrice,
  isNewModel,
  localize,
  MODELS,
  type Model,
} from '@/lib/catalog';
import { useCurrency, useEdition } from '@/lib/use-catalog-state';

/** 模型格：名称、折扣标、「新」标、调用名和一行描述（让 Nano Banana 等别名可见）。 */
function ImageModelCell({ model }: { model: Model }) {
  const t = useTranslations('pricing');
  const locale = useLocale();
  const [edition] = useEdition();
  const discount = editionDiscount(edition);

  return (
    <td className="px-5 py-4 align-top">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{model.name}</span>
        <DiscountBadge discount={discount} locale={locale} />
        {isNewModel(model) ? <Badge tone="info">{t('tables.new')}</Badge> : null}
      </div>
      <p className="mt-1 font-mono text-xs text-subtle-foreground">{model.id}</p>
      <p className="mt-1 line-clamp-1 max-w-md text-xs text-muted-foreground">
        {localize(model.description, locale)}
      </p>
    </td>
  );
}

/** 价格格：按张逐档列出，按 Token 显示每百万 Token 单价加每张估算。 */
function ImagePriceCell({ model }: { model: Model }) {
  const c = useTranslations('common');
  const [edition] = useEdition();
  const [currency] = useCurrency();
  const price = imagePrice(model, edition);

  if (!price) {
    return (
      <td data-cell="price" className="px-5 py-4 text-right align-top tabular-nums text-foreground">
        —
      </td>
    );
  }

  if (price.kind === 'per-image') {
    return (
      <td data-cell="price" className="px-5 py-4 text-right align-top tabular-nums text-foreground">
        {price.resolutions.map((resolution) => (
          <div key={resolution.label} className="flex justify-end gap-2">
            <span className="text-subtle-foreground">{resolution.label}</span>
            <span>{formatMoney(resolution.price, currency)}</span>
            <span className="text-subtle-foreground">{c('units.perImage')}</span>
          </div>
        ))}
      </td>
    );
  }

  return (
    <td data-cell="price" className="px-5 py-4 text-right align-top tabular-nums text-foreground">
      <div className="flex items-baseline justify-end gap-2">
        <span>{formatMoney(price.perMTokens, currency)}</span>
        <span className="text-subtle-foreground">{c('units.perMTokens')}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        ≈ {formatMoney(price.estimatedPerImage, currency)} {c('units.perImage')}
      </div>
    </td>
  );
}

/** 生图模型价目表：按厂商分段，三列分别是模型、计费方式、价格。 */
export function ImagePriceTable() {
  const t = useTranslations('pricing');
  const imageGroups = groupByProvider(MODELS.filter((model) => model.type === 'image'));

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
              {imageGroups.map((group) => (
                <ImageProviderSection
                  key={group.provider}
                  provider={group.provider}
                  models={group.models}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** 一个厂商的分段：一行厂商标题 + 若干模型行。 */
function ImageProviderSection({
  provider,
  models,
}: {
  provider: Model['provider'];
  models: readonly Model[];
}) {
  const providerInfo = getProvider(provider);

  return (
    <>
      <tr data-provider-row={provider}>
        <td colSpan={3} className="border-t border-border bg-muted/50 px-5 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ProviderLogo provider={provider} size={16} />
            {providerInfo.name}
          </div>
        </td>
      </tr>
      {models.map((model) => (
        <ImageModelRow key={model.id} model={model} />
      ))}
    </>
  );
}

/** 模型行：计费方式与价格格都从数据层生图价取值。 */
function ImageModelRow({ model }: { model: Model }) {
  const t = useTranslations('pricing');
  const [edition] = useEdition();
  const price = imagePrice(model, edition);

  return (
    <tr
      id={`model-${model.id}`}
      data-price-row={model.id}
      className="scroll-mt-28 border-t border-border transition-colors hover:bg-muted/40 target:bg-info-soft"
    >
      <ImageModelCell model={model} />
      <td className="px-5 py-4 align-top text-muted-foreground">
        {price?.kind === 'per-image'
          ? t('tables.perImageBilling')
          : price?.kind === 'per-token'
            ? t('tables.perTokenBilling')
            : '—'}
      </td>
      <ImagePriceCell model={model} />
    </tr>
  );
}
