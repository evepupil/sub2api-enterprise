'use client';

import { Fragment } from 'react';

import { useTranslations } from 'next-intl';

import { formatMoney, IMAGE_TOKENS_PER_IMAGE } from '@/lib/catalog';
import { groupSiteModels, priceRowId, type SiteModel } from '@/lib/catalog/live';

import { PriceGroupCell } from './pricing-group-cell';
import { PriceProviderRow } from './pricing-provider-row';

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** 模型格：名称、调用名。同一个模型在几个分组里就合并几行。 */
function ImageModelCell({ model, span }: { model: SiteModel; span: number }) {
  return (
    <td rowSpan={span} className="px-5 py-4 align-top">
      <span className="font-medium text-foreground">{model.name}</span>
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
  const { price } = model;
  const cell = 'px-5 py-4 text-right align-top tabular-nums text-foreground';

  if (price.kind === 'request') {
    return (
      <td data-cell="price" className={cell}>
        <div className="flex items-baseline justify-end gap-2">
          <span>{formatMoney(price.price)}</span>
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
          <span>{formatMoney(price.output)}</span>
          <span className="text-subtle-foreground">{c('units.perMTokens')}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {c('units.approx')}{' '}
          {formatMoney(round6((price.output * IMAGE_TOKENS_PER_IMAGE) / 1_000_000))}{' '}
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

/** 一个分组一行：计费方式与价格都按这个分组的实付价（来自后台）。span 大于 0 是这个模型的第一行，带上合并的模型格。 */
function ImageModelRow({ model, span }: { model: SiteModel; span: number }) {
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
      id={priceRowId(model)}
      data-price-row={model.id}
      data-group={model.group.name}
      className="scroll-mt-28 border-t border-border transition-colors hover:bg-muted/40 target:bg-info-soft"
    >
      {span > 0 ? <ImageModelCell model={model} span={span} /> : null}
      <PriceGroupCell model={model} />
      <td className="px-5 py-4 align-top text-muted-foreground">{billing}</td>
      <ImagePriceCell model={model} />
    </tr>
  );
}

/** 生图模型价目表：按厂商分段，四列分别是模型、分组、计费方式、价格；同一个模型的几个分组挨着、便宜的在前。 */
export function ImagePriceTable({ models }: { models: readonly SiteModel[] }) {
  const t = useTranslations('pricing');
  const sections = groupSiteModels(models);

  const columns = [
    { label: t('tables.model'), align: 'left' },
    { label: t('tables.group'), align: 'left' },
    { label: t('tables.billing'), align: 'left' },
    { label: t('tables.price'), align: 'right' },
  ] as const;

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
          <table data-price-table="image" className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-surface">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.label}
                    scope="col"
                    className={
                      column.align === 'left'
                        ? 'px-5 py-3 text-left text-xs font-medium text-subtle-foreground'
                        : 'px-5 py-3 text-right text-xs font-medium text-subtle-foreground'
                    }
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <Fragment key={section.provider ?? 'other'}>
                  <PriceProviderRow provider={section.provider} colSpan={columns.length} />
                  {section.entries.map((entry) =>
                    entry.rows.map((model, index) => (
                      <ImageModelRow
                        key={model.key}
                        model={model}
                        span={index === 0 ? entry.rows.length : 0}
                      />
                    )),
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
