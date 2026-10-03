'use client';

import { useLocale, useTranslations } from 'next-intl';

import { formatRatio, getEdition, localize } from '@/lib/catalog';
import { useEdition } from '@/lib/use-catalog-state';
import { cn } from '@/lib/utils';

/** 当前版本的四项关键指标：可用率目标、渠道、单密钥每分钟请求、分组倍率（企业版显示「定制」）。 */
export function EditionSummary({ className }: { className?: string }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const [editionId] = useEdition();
  const edition = getEdition(editionId);

  const items = [
    { key: 'sla', label: t('editionSummary.sla'), value: `${edition.slaTarget.toFixed(1)}%` },
    {
      key: 'channel',
      label: t('editionSummary.channel'),
      value: localize(edition.channel, locale),
    },
    {
      key: 'rpm',
      label: t('editionSummary.rpm'),
      value: edition.rpm.toLocaleString('en-US'),
    },
    {
      key: 'ratio',
      label: t('editionSummary.ratio'),
      value: formatRatio(edition.ratio, locale),
    },
  ];

  return (
    <div
      data-edition-summary
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm',
        className,
      )}
    >
      {items.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5">
          <span className="text-subtle-foreground">{item.label}</span>
          <span data-summary={item.key} className="font-medium tabular-nums text-foreground">
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );
}
