'use client';

import { useTranslations } from 'next-intl';

import { ProviderLogo } from '@/components/catalog/provider-logo';
import { getProvider, type ProviderId } from '@/lib/catalog';

/** 价目表里一个厂商分段的标题行；认不出厂商的模型归在「其他」 */
export function PriceProviderRow({
  provider,
  colSpan,
}: {
  provider: ProviderId | null;
  colSpan: number;
}) {
  const t = useTranslations('pricing');
  return (
    <tr data-provider-row={provider ?? 'other'}>
      <td colSpan={colSpan} className="border-t border-border bg-muted/50 px-5 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {provider ? <ProviderLogo provider={provider} size={16} /> : null}
          {provider ? getProvider(provider).name : t('tables.otherProvider')}
        </div>
      </td>
    </tr>
  );
}
