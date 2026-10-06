'use client';

import type { Currency } from './catalog/pricing';
import { useUrlState } from './use-url-state';

const CURRENCIES: readonly Currency[] = ['usd', 'cny'];

/** 价格展示币种，存在网址 ?currency= 里，默认美元 */
export function useCurrency(): [Currency, (next: Currency) => void] {
  return useUrlState('currency', CURRENCIES, 'usd');
}
