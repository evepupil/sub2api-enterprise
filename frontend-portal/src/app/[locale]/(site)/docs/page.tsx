import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { DocsPlaceholder } from '@/blocks/misc/docs-placeholder';
import { initPage, type LocaleParams } from '@/i18n/page';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'misc' });
  return { title: t('meta.docsTitle') };
}

export default async function DocsPage({ params }: LocaleParams) {
  await initPage(params);
  return <DocsPlaceholder />;
}
