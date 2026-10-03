'use client';

import { useTranslations } from 'next-intl';

import { SegmentedControl } from '@/components/ui/segmented-control';
import { SORT_KEYS, type SortKey } from '@/lib/catalog';
import { cnyPerUsd, type LiveCurrency } from '@/lib/console/live/models-view';

const SORT_LABEL = {
  latest: 'sort.latest',
  'price-asc': 'sort.priceAsc',
  'price-desc': 'sort.priceDesc',
  context: 'sort.context',
} as const satisfies Record<SortKey, string>;

/**
 * 排序与币种：左边排序，右边币种。通道不再单独选，表格里每行都写着通道和倍率。
 * 切到人民币时下方补一行折算说明（按充值比例），提醒钱包仍按美元扣费。
 */
export function ModelsToolbar({
  sort,
  onSortChange,
  currency,
  onCurrencyChange,
  rechargeMultiplier,
}: {
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  currency: LiveCurrency;
  onCurrencyChange: (currency: LiveCurrency) => void;
  rechargeMultiplier: number;
}) {
  const t = useTranslations('consoleModels');

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* 英文标签较长，手机宽度放不下时在自己的框里横向滚动，不撑破页面 */}
        <div className="min-w-0 max-w-full overflow-x-auto">
          <SegmentedControl
            name="model-sort"
            size="sm"
            value={sort}
            onChange={onSortChange}
            ariaLabel={t('sort.label')}
            options={SORT_KEYS.map((value) => ({ value, label: t(SORT_LABEL[value]) }))}
          />
        </div>
        <SegmentedControl
          name="model-currency"
          size="sm"
          value={currency}
          onChange={onCurrencyChange}
          ariaLabel={t('currency.label')}
          options={[
            { value: 'usd', label: t('currency.usd') },
            { value: 'cny', label: t('currency.cny') },
          ]}
        />
      </div>
      {currency === 'cny' ? (
        <p className="text-xs text-subtle-foreground">
          {t('currency.note', { rate: cnyPerUsd(rechargeMultiplier) })}
        </p>
      ) : null}
    </div>
  );
}
