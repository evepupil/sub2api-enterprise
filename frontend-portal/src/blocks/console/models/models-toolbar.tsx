'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Select, type SelectOption } from '@/components/console/select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { AppLocale } from '@/i18n/routing';
import {
  EDITIONS,
  SORT_KEYS,
  USD_CNY_RATE,
  formatRatio,
  type Currency,
  type EditionId,
  type SortKey,
} from '@/lib/catalog';

const SORT_LABEL = {
  latest: 'sort.latest',
  'price-asc': 'sort.priceAsc',
  'price-desc': 'sort.priceDesc',
  context: 'sort.context',
} as const satisfies Record<SortKey, string>;

/**
 * 排序、通道、币种：左边排序，右边选通道（决定价格按哪个倍率算）和币种。
 * 切到人民币时下方补一行折算说明，提醒钱包仍按美元扣费。
 */
export function ModelsToolbar({
  sort,
  onSortChange,
  group,
  onGroupChange,
  currency,
  onCurrencyChange,
}: {
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  group: EditionId;
  onGroupChange: (group: EditionId) => void;
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
}) {
  const t = useTranslations('consoleModels');
  const locale = useLocale() as AppLocale;

  const groupOptions: SelectOption<EditionId>[] = EDITIONS.map((edition) => ({
    value: edition.id,
    label: `${edition.name[locale]} ${formatRatio(edition.ratio, locale)}`,
  }));

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
        <div className="flex flex-wrap items-center gap-2">
          <Select
            name="model-group"
            className="w-44"
            ariaLabel={t('group')}
            value={group}
            onChange={onGroupChange}
            options={groupOptions}
          />
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
      </div>
      {currency === 'cny' ? (
        <p className="text-xs text-subtle-foreground">
          {t('currency.note', { rate: USD_CNY_RATE })}
        </p>
      ) : null}
    </div>
  );
}
