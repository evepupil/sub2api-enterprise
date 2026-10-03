import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { UsagePage } from '@/blocks/console/usage/usage-page';
import { initPage, type LocaleParams } from '@/i18n/page';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'consoleUsage' });
  return { title: t('meta.title') };
}

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <UsagePage />;
}
