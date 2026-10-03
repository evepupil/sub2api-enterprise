import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ModelsExplorer } from '@/blocks/models/models-explorer';
import { ModelsHero } from '@/blocks/models/models-hero';
import { initPage, type LocaleParams } from '@/i18n/page';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'models' });
  return { title: t('meta.title'), description: t('meta.description') };
}

export default async function ModelsPage({ params }: LocaleParams) {
  await initPage(params);
  return (
    <>
      <ModelsHero />
      <ModelsExplorer />
    </>
  );
}
