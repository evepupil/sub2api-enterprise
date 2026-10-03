import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PricingFaq } from '@/blocks/pricing/pricing-faq';
import { PricingHero } from '@/blocks/pricing/pricing-hero';
import { PricingNotes } from '@/blocks/pricing/pricing-notes';
import { PricingTables } from '@/blocks/pricing/pricing-tables';
import { initPage, type LocaleParams } from '@/i18n/page';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'pricing' });
  return { title: t('meta.title'), description: t('meta.description') };
}

export default async function PricingPage({ params }: LocaleParams) {
  await initPage(params);
  return (
    <>
      <PricingHero />
      <PricingTables />
      <PricingNotes />
      <PricingFaq />
    </>
  );
}
