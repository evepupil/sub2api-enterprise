'use client';

import { Fragment } from 'react';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { formatContext, formatMoney } from '@/lib/catalog';
import { groupSiteModels, priceRowId, type SiteModel } from '@/lib/catalog/live';

import { PriceGroupCell } from './pricing-group-cell';
import { PriceProviderRow } from './pricing-provider-row';

const money = (value: number | null) => (value === null ? '—' : formatMoney(value));

/** 模型格：名称、「新」标、调用名。同一个模型在几个分组里就合并几行。 */
function TextModelCell({ model, span }: { model: SiteModel; span: number }) {
  const t = useTranslations('pricing');
  return (
    <td rowSpan={span} className="px-5 py-4 align-top">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{model.name}</span>
        {model.isNew ? <Badge tone="info">{t('tables.new')}</Badge> : null}
      </div>
      {/* 官网目录里没有的模型名字就是调用名，不重复写 */}
      {model.name === model.id ? null : (
        <p className="mt-1 font-mono text-xs text-subtle-foreground">{model.id}</p>
      )}
    </td>
  );
}

/**
 * 一个分组一行：输入、输出、缓存读取都是这个分组的实付价（来自后台），缺失时显示「—」；按次计费的写在输入格；
 * 分组按长上下文分档计费时，分组格里再补一行超长档单价。span 大于 0 是这个模型的第一行，带上合并的模型格与上下文格。
 */
function TextModelRow({ model, span }: { model: SiteModel; span: number }) {
  const t = useTranslations('pricing');
  const c = useTranslations('common');
  const { price } = model;
  const tier = price.kind === 'token' ? price.longContext : null;
  const cell = 'whitespace-nowrap px-5 py-4 text-right align-top tabular-nums text-foreground';

  return (
    <tr
      id={priceRowId(model)}
      data-price-row={model.id}
      data-group={model.group.name}
      className="scroll-mt-28 border-t border-border transition-colors hover:bg-muted/40 target:bg-info-soft"
    >
      {span > 0 ? <TextModelCell model={model} span={span} /> : null}
      <PriceGroupCell model={model}>
        {tier ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('tables.longContext', {
              threshold: formatContext(tier.threshold),
              input: money(tier.input),
              output: money(tier.output),
            })}
          </p>
        ) : null}
      </PriceGroupCell>
      <td data-cell="input" className={cell}>
        {price.kind === 'token'
          ? money(price.input)
          : price.kind === 'request'
            ? `${formatMoney(price.price)} ${c('units.perRequest')}`
            : '—'}
      </td>
      <td data-cell="output" className={cell}>
        {price.kind === 'token' ? money(price.output) : '—'}
      </td>
      <td data-cell="cache" className={cell}>
        {money(model.cacheRead)}
      </td>
      {span > 0 ? (
        <td
          rowSpan={span}
          className="whitespace-nowrap px-5 py-4 text-right align-top tabular-nums text-muted-foreground"
        >
          {model.contextTokens === null ? '—' : formatContext(model.contextTokens)}
        </td>
      ) : null}
    </tr>
  );
}

/** 文本模型价目表：按厂商分段，六列分别是模型、分组、输入、输出、缓存读取、上下文；同一个模型的几个分组挨着、便宜的在前。 */
export function TextPriceTable({ models }: { models: readonly SiteModel[] }) {
  const t = useTranslations('pricing');
  const sections = groupSiteModels(models);

  const columns = [
    { label: t('tables.model'), align: 'left' },
    { label: t('tables.group'), align: 'left' },
    { label: t('tables.input'), align: 'right' },
    { label: t('tables.output'), align: 'right' },
    { label: t('tables.cache'), align: 'right' },
    { label: t('tables.context'), align: 'right' },
  ] as const;

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
          <table data-price-table="text" className="w-full min-w-[880px] border-collapse text-sm">
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
                      <TextModelRow
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
