import { useTranslations } from 'next-intl';

import { EditionSummary } from '@/components/catalog/edition-summary';
import { EditionSwitcher } from '@/components/catalog/edition-switcher';
import { PageHero } from '@/components/layout/page-hero';

import { PricingHeroCurrency } from './pricing-hero-currency';

/** 价格页页首：标题、版本与币种切换、当前版本指标。切换都写进网址参数，价目表区块读同一参数。 */
export function PricingHero() {
  const t = useTranslations('pricing');

  return (
    <PageHero id="pricing-hero" title={t('hero.title')} subtitle={t('hero.subtitle')}>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <EditionSwitcher />
        <PricingHeroCurrency />
      </div>
      <EditionSummary />
    </PageHero>
  );
}

export default PricingHero;
