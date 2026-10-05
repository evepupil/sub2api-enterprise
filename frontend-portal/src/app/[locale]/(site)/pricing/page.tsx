import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PricingFaq } from '@/blocks/pricing/pricing-faq';
import { PricingHero } from '@/blocks/pricing/pricing-hero';
import { PricingNotes } from '@/blocks/pricing/pricing-notes';
import { PricingTables } from '@/blocks/pricing/pricing-tables';
import { initPage, type LocaleParams } from '@/i18n/page';
import { getSiteCatalog } from '@/lib/server/site-catalog';

/**
 * 模型数据来自后台：每次打开都用官网服务器缓存（60 秒）里的数据现做页面，不在构建时预先生成——
 * 构建时通常连不上后台，预先生成会让部署后的第一位访客看到空页面。
 */
export const dynamic = 'force-dynamic';

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
