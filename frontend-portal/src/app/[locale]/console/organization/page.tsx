import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { OrganizationPage } from '@/blocks/console/organization/organization-page';
import { initPage, type LocaleParams } from '@/i18n/page';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'consoleOrg' });
  return { title: t('meta.title') };
}

export default async function Page({ params }: LocaleParams) {
  await initPage(params);
  return <OrganizationPage />;
}
