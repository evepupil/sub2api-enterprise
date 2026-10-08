import { useTranslations } from 'next-intl';

import { TopUpRate } from '@/components/catalog/top-up-rate';
import { PageHero } from '@/components/layout/page-hero';

/** 价格页页首：标题、副标题，下面一行小字写充值比例（价格只写美元，充值 1 元 = 1 美元）。 */
export function PricingHero() {
  const t = useTranslations('pricing');

  return (
    <PageHero
      id="pricing-hero"
      title={t('hero.title')}
      subtitle={t('hero.subtitle')}
      note={<TopUpRate />}
    />
  );
}

export default PricingHero;
