'use client';

import { useLocale, useTranslations } from 'next-intl';

import { DiscountBadge } from '@/components/catalog/discount-badge';
import { ProviderLogo } from '@/components/catalog/provider-logo';
import { Badge } from '@/components/ui/badge';
import {
  editionDiscount,
  formatContext,
  formatMoney,
  getProvider,
  groupByProvider,
  isNewModel,
  MODELS,
  textPrice,
  type Model,
} from '@/lib/catalog';
import { useCurrency, useEdition } from '@/lib/use-catalog-state';

/** 模型格：名称、折扣标、「新」标、调用名，有超长上下文档位时再补一行说明。 */
function TextModelCell({ model }: { model: Model }) {
  const t = useTranslations('pricing');
  const locale = useLocale();
  const [currency] = useCurrency();
  const [edition] = useEdition();
  const price = textPrice(model, edition);
  const tier = price?.longContext ?? null;
  const discount = editionDiscount(edition);

  return (
    <td className="px-5 py-4 align-top">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{model.name}</span>
        <DiscountBadge discount={discount} locale={locale} />
        {isNewModel(model) ? <Badge tone="info">{t('tables.new')}</Badge> : null}
      </div>
      <p className="mt-1 font-mono text-xs text-subtle-foreground">{model.id}</p>
      {tier ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('tables.longContext', {
            threshold: formatContext(tier.threshold),
            input: formatMoney(tier.input, currency),
            output: formatMoney(tier.output, currency),
          })}
        </p>
      ) : null}
    </td>
  );
}

/** 文本模型价目表：按厂商分段，五列分别是模型、输入、输出、缓存读取、上下文。 */
export function TextPriceTable() {
  const t = useTranslations('pricing');
  const textGroups = groupByProvider(MODELS.filter((model) => model.type === 'text'));

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
              {textGroups.map((group) => (
                <TextProviderSection
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
function TextProviderSection({
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
        <td colSpan={5} className="border-t border-border bg-muted/50 px-5 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ProviderLogo provider={provider} size={16} />
            {providerInfo.name}
          </div>
        </td>
      </tr>
      {models.map((model) => (
        <TextModelRow key={model.id} model={model} />
      ))}
    </>
  );
}

/** 模型行：三个金额格从数据层单价取值，缺失时显示「—」。 */
function TextModelRow({ model }: { model: Model }) {
  const [edition] = useEdition();
  const [currency] = useCurrency();
  const price = textPrice(model, edition);

  return (
    <tr
      id={`model-${model.id}`}
      data-price-row={model.id}
      className="scroll-mt-28 border-t border-border transition-colors hover:bg-muted/40 target:bg-info-soft"
    >
      <TextModelCell model={model} />
      <td
        data-cell="input"
        className="whitespace-nowrap px-5 py-4 text-right align-top tabular-nums text-foreground"
      >
        {price ? formatMoney(price.input, currency) : '—'}
      </td>
      <td
        data-cell="output"
        className="whitespace-nowrap px-5 py-4 text-right align-top tabular-nums text-foreground"
      >
        {price ? formatMoney(price.output, currency) : '—'}
      </td>
      <td
        data-cell="cache"
        className="whitespace-nowrap px-5 py-4 text-right align-top tabular-nums text-foreground"
      >
        {price ? formatMoney(price.cacheRead, currency) : '—'}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right align-top tabular-nums text-muted-foreground">
        {model.contextTokens === null ? '—' : formatContext(model.contextTokens)}
      </td>
    </tr>
  );
}
