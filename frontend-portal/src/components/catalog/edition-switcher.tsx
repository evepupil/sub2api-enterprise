'use client';

import { useLocale, useTranslations } from 'next-intl';

import { SegmentedControl } from '@/components/ui/segmented-control';
import { EDITIONS, localize } from '@/lib/catalog';
import { useEdition } from '@/lib/use-catalog-state';

/** 通道切换（共享通道 / 专用通道 / 企业通道），选择存在网址 ?edition= 里，同页所有读它的区块一起变。 */
export function EditionSwitcher({ className, size }: { className?: string; size?: 'sm' | 'md' }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const [edition, setEdition] = useEdition();

  return (
    <SegmentedControl
      name="edition"
      value={edition}
      onChange={setEdition}
      options={EDITIONS.map((item) => ({ value: item.id, label: localize(item.name, locale) }))}
      ariaLabel={t('edition.label')}
      size={size}
      className={className}
    />
  );
}
