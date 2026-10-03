'use client';

import { useTranslations } from 'next-intl';

import { DiscountBadge } from '@/components/catalog/discount-badge';
import type { AppLocale } from '@/i18n/routing';
import {
  editionDiscount,
  editionRatio,
  formatContext,
  type Currency,
  type EditionId,
  type Model,
} from '@/lib/catalog';
import { cn } from '@/lib/utils';

import { priceViewAt, type PriceView } from './models-price-view';

/** 价格主行：文本是「输入 / 输出」，生图是「起价 / 张起」或「≈ 每张 / 张」 */
function PriceMain({ view }: { view: PriceView }) {
  const t = useTranslations('consoleModels');
  switch (view.kind) {
    case 'text':
      return <>{`${view.input} / ${view.output}`}</>;
    case 'image-from':
      return <>{t('table.perImageFrom', { price: view.price })}</>;
    case 'image-approx':
      return <>{t('table.perImageApprox', { price: view.price })}</>;
  }
}

/**
 * 价格列：当前通道的实际价格（官方价 × 通道倍率）。
 * 倍率按合同定制的通道（企业通道）没有固定单价，显示「定制」。
 * 交互检查用 data-model-price 取这一格。
 */
export function ModelPrice({
  model,
  group,
  currency,
}: {
  model: Model;
  group: EditionId;
  currency: Currency;
}) {
  const t = useTranslations('consoleModels');
  const ratio = editionRatio(group);
  const view = ratio === null ? null : priceViewAt(model, ratio, currency);

  return (
    <div data-model-price={model.id} className="tabular-nums">
      {ratio === null ? (
        <p className="font-medium text-foreground">{t('table.custom')}</p>
      ) : view ? (
        <>
          <p className="font-medium text-foreground">
            <PriceMain view={view} />
          </p>
          {view.kind === 'text' ? (
            <p className="text-xs text-subtle-foreground">{t('table.perMTokens')}</p>
          ) : null}
          {/* 超过阈值后的加价档：只有部分文本模型有 */}
          {view.kind === 'text' && view.longContext ? (
            <p className="text-xs text-subtle-foreground">
              {t('table.longContext', {
                threshold: formatContext(view.longContext.threshold),
                input: view.longContext.input,
                output: view.longContext.output,
              })}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * 折扣列：折扣标加一行官方价。打折的通道把官方价划掉，让人一眼看出省了多少；
 * 企业通道没有折扣标，官方价只是参考，不划线。
 */
export function ModelDiscount({
  model,
  group,
  currency,
  locale,
}: {
  model: Model;
  group: EditionId;
  currency: Currency;
  locale: AppLocale;
}) {
  const discount = editionDiscount(group);
  const official = priceViewAt(model, 1, currency);

  return (
    <div className="flex flex-col items-start gap-1">
      <DiscountBadge discount={discount} locale={locale} />
      {official ? (
        <p
          className={cn(
            'text-xs tabular-nums text-subtle-foreground',
            discount !== null && 'line-through',
          )}
        >
          <PriceMain view={official} />
        </p>
      ) : null}
    </div>
  );
}
