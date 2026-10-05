'use client';

import { Fragment } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import { DiscountBadge } from '@/components/catalog/discount-badge';
import { Badge } from '@/components/ui/badge';
import { formatContext, formatMoney, type Currency } from '@/lib/catalog';
import { groupSiteModels, type SiteModel } from '@/lib/catalog/live';
import { useCurrency } from '@/lib/use-catalog-state';

import { PriceProviderRow } from './pricing-provider-row';

const money = (value: number | null, currency: Currency) =>
  value === null ? '—' : formatMoney(value, currency);

/** 模型格：名称、折扣标、「新」标、调用名，分组按长上下文分档计费时再补一行超长档单价。 */
function TextModelCell({ model }: { model: SiteModel }) {
  const t = useTranslations('pricing');
  const locale = useLocale();
  const [currency] = useCurrency();
  const tier = model.price.kind === 'token' ? model.price.longContext : null;

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
      {tier ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('tables.longContext', {
            threshold: formatContext(tier.threshold),
            input: money(tier.input, currency),
            output: money(tier.output, currency),
          })}
        </p>
      ) : null}
    </td>
  );
}

/** 模型行：输入、输出、缓存读取都是所选通道的实付价（来自后台），缺失时显示「—」；按次计费的写在输入格。 */
function TextModelRow({ model }: { model: SiteModel }) {
  const c = useTranslations('common');
  const [currency] = useCurrency();
  const { price } = model;
  const cell = 'whitespace-nowrap px-5 py-4 text-right align-top tabular-nums text-foreground';

  return (
    <tr
      id={`model-${model.id}`}
      data-price-row={model.id}
      className="scroll-mt-28 border-t border-border transition-colors hover:bg-muted/40 target:bg-info-soft"
    >
      <TextModelCell model={model} />
      <td data-cell="input" className={cell}>
        {price.kind === 'token'
          ? money(price.input, currency)
          : price.kind === 'request'
            ? `${formatMoney(price.price, currency)} ${c('units.perRequest')}`
            : '—'}
      </td>
      <td data-cell="output" className={cell}>
        {price.kind === 'token' ? money(price.output, currency) : '—'}
      </td>
      <td data-cell="cache" className={cell}>
        {money(model.cacheRead, currency)}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right align-top tabular-nums text-muted-foreground">
        {model.contextTokens === null ? '—' : formatContext(model.contextTokens)}
      </td>
    </tr>
  );
}

/** 文本模型价目表：按厂商分段，五列分别是模型、输入、输出、缓存读取、上下文。 */
export function TextPriceTable({ models }: { models: readonly SiteModel[] }) {
  const t = useTranslations('pricing');
  const sections = groupSiteModels(models);

  const columns = [
    t('tables.model'),
    t('tables.input'),
    t('tables.output'),
    t('tables.cache'),
    t('tables.context'),
  ];

  return (
    <div id="text-models" className="scroll-mt-28">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-2xl font-medium tracking-tight text-foreground">
          {t('tables.textTitle')}
        </h2>
        <p className="text-xs text-subtle-foreground">{t('tables.perMTokens')}</p>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table data-price-table="text" className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-surface">
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column}
                    scope="col"
                    className={
                      index === 0
                        ? 'px-5 py-3 text-left text-xs font-medium text-subtle-foreground'
                        : 'px-5 py-3 text-right text-xs font-medium text-subtle-foreground'
                    }
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <Fragment key={section.provider ?? 'other'}>
                  <PriceProviderRow provider={section.provider} colSpan={5} />
                  {section.models.map((model) => (
                    <TextModelRow key={model.id} model={model} />
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
