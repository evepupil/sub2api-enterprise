'use client';

import { useTranslations } from 'next-intl';

import { SegmentedControl } from '@/components/ui/segmented-control';
import type { Currency } from '@/lib/catalog';
import { useCurrency } from '@/lib/use-catalog-state';

/** 币种切换（美元 / 人民币），选择存在网址 ?currency= 里，价目表区块读同一参数跟着换算。 */
export function PricingHeroCurrency() {
  const t = useTranslations('pricing');
  const [currency, setCurrency] = useCurrency();

  return (
    <SegmentedControl<Currency>
      name="currency"
      value={currency}
      onChange={setCurrency}
      ariaLabel={t('hero.currency')}
      size="md"
      options={[
        { value: 'usd', label: t('hero.usd') },
        { value: 'cny', label: t('hero.cny') },
      ]}
    />
  );
}

export default PricingHeroCurrency;
