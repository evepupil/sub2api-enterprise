import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LegalDocument } from '@/blocks/legal/legal-document';
import { initPage, type LocaleParams } from '@/i18n/page';
import { pageAlternates } from '@/lib/seo';
import { loadMessages } from '@/messages';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'legal' });
  return { title: t('meta.privacyTitle'), alternates: pageAlternates(locale, '/privacy') };
}

/** 隐私政策：正文在 legal.json 的 privacy */
export default async function PrivacyPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  return <LegalDocument id="privacy" doc={loadMessages(locale).legal.privacy} />;
}
