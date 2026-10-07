import { useTranslations } from 'next-intl';

import { PageHero } from '@/components/layout/page-hero';

/** 价格页页首：标题与副标题。价格只写美元（充值 1 元 = 1 美元，见计费说明）。 */
export function PricingHero() {
  const t = useTranslations('pricing');

  return <PageHero id="pricing-hero" title={t('hero.title')} subtitle={t('hero.subtitle')} />;
}

export default PricingHero;
