import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { DocsPlaceholder } from '@/blocks/misc/docs-placeholder';
import { initPage, type LocaleParams } from '@/i18n/page';
import { SITE_FEATURES } from '@/lib/site';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'misc' });
  return { title: t('meta.docsTitle') };
}

/** 文档页：还是占位，首发入口不开（src/lib/site.ts 的 SITE_FEATURES.docs），直接打开也是 404 */
export default async function DocsPage({ params }: LocaleParams) {
  await initPage(params);
  if (!SITE_FEATURES.docs) notFound();
  return <DocsPlaceholder />;
}
