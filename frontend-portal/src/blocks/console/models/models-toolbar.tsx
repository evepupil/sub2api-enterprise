'use client';

import { useTranslations } from 'next-intl';

import { SegmentedControl } from '@/components/ui/segmented-control';
import { SORT_KEYS, type SortKey } from '@/lib/catalog';

const SORT_LABEL = {
  latest: 'sort.latest',
  'price-asc': 'sort.priceAsc',
  'price-desc': 'sort.priceDesc',
  context: 'sort.context',
} as const satisfies Record<SortKey, string>;

/**
 * 排序：分组不再单独选，表格里每行都写着分组和倍率。价格只写美元（充值 1 元 = 1 美元）。
 */
export function ModelsToolbar({
  sort,
  onSortChange,
}: {
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
}) {
  const t = useTranslations('consoleModels');

  return (
    // 英文标签较长，手机宽度放不下时在自己的框里横向滚动，不撑破页面
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
  );
}
