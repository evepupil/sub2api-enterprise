import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ConsoleModelsPage } from '@/blocks/console/models/models-page';
import { initPage, type LocaleParams } from '@/i18n/page';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'consoleModels' });
  return { title: t('meta.title') };
}

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <ConsoleModelsPage />;
}
