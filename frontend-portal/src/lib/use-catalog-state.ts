'use client';

import { EDITION_IDS } from './catalog/editions';
import type { Currency } from './catalog/pricing';
import type { EditionId } from './catalog/types';
import { useUrlState } from './use-url-state';

const CURRENCIES: readonly Currency[] = ['usd', 'cny'];

/**
 * 当前查看的服务版本，存在网址 ?edition= 里。
 * 模型页、价格页、分组页的版本切换和价格展示都读写它，跨区块、跨页面链接都保持一致。
 */
export function useEdition(): [EditionId, (next: EditionId) => void] {
  return useUrlState('edition', EDITION_IDS, 'personal');
}

/** 价格展示币种，存在网址 ?currency= 里，默认美元 */
export function useCurrency(): [Currency, (next: Currency) => void] {
  return useUrlState('currency', CURRENCIES, 'usd');
}
