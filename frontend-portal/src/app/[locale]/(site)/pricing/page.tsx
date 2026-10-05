import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PricingFaq } from '@/blocks/pricing/pricing-faq';
import { PricingHero } from '@/blocks/pricing/pricing-hero';
import { PricingNotes } from '@/blocks/pricing/pricing-notes';
import { PricingTables } from '@/blocks/pricing/pricing-tables';
import { initPage, type LocaleParams } from '@/i18n/page';
import { getSiteCatalog } from '@/lib/server/site-catalog';

/** 价目表来自后台，页面每 60 秒重新生成一次（和数据缓存同步） */
export const revalidate = 60;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'pricing' });
  return { title: t('meta.title'), description: t('meta.description') };
}

export default async function PricingPage({ params }: LocaleParams) {
  await initPage(params);
  const catalog = await getSiteCatalog();
  return (
    <>
      <PricingHero />
      <PricingTables catalog={catalog} />
      <PricingNotes />
      <PricingFaq />
    </>
  );
}
