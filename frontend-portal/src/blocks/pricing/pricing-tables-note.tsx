'use client';

import { useTranslations } from 'next-intl';

import { USD_CNY_RATE } from '@/lib/catalog';
import { useCurrency } from '@/lib/use-catalog-state';

/** 单位说明跟币种切换联动：美元按原价显示，人民币按固定汇率折算并注明钱包仍按美元扣费。 */
export function CurrencyNote() {
  const t = useTranslations('pricing');
  const [currency] = useCurrency();

  return (
    <p data-currency-note className="text-xs text-subtle-foreground">
      {currency === 'cny' ? t('tables.unitCny', { rate: USD_CNY_RATE }) : t('tables.unitUsd')}
    </p>
  );
}
