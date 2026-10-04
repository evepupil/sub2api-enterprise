import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuthShowcase } from '@/blocks/auth/auth-showcase';
import { ResetPasswordPanel } from '@/blocks/auth/reset-password-panel';
import { initPage, type LocaleParams } from '@/i18n/page';

/** 网址里带着一次性凭证：不进搜索引擎，也不把网址当来源告诉别的网站 */
export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return {
    title: t('meta.resetTitle'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function ResetPasswordPage({ params }: LocaleParams) {
  await initPage(params);
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <ResetPasswordPanel />
      <AuthShowcase />
    </div>
  );
}
