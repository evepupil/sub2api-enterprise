import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { LegalDocument } from '@/blocks/legal/legal-document';
import { initPage, type LocaleParams } from '@/i18n/page';
import { pageAlternates } from '@/lib/seo';
import { loadMessages } from '@/messages';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'legal' });
  return { title: t('meta.termsTitle'), alternates: pageAlternates(locale, '/terms') };
}

/** 服务条款：正文在 legal.json 的 terms，退款一节的锚点是 #refund（页脚「退款政策」跳到这里） */
export default async function TermsPage({ params }: LocaleParams) {
  const locale = await initPage(params);
  return <LegalDocument id="terms" doc={loadMessages(locale).legal.terms} />;
}
