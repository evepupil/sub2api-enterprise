import { useTranslations } from 'next-intl';

import { PageHero } from '@/components/layout/page-hero';

import { PricingHeroCurrency } from './pricing-hero-currency';

/** 价格页页首：标题与币种切换。币种写进网址参数，价目表区块读同一参数。 */
export function PricingHero() {
  const t = useTranslations('pricing');

  return (
    <PageHero id="pricing-hero" title={t('hero.title')} subtitle={t('hero.subtitle')}>
      <PricingHeroCurrency />
    </PageHero>
  );
}

export default PricingHero;
