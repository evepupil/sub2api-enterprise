import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuthShowcase } from '@/blocks/auth/auth-showcase';
import { ForgotPasswordPanel } from '@/blocks/auth/forgot-password-panel';
import { initPage, type LocaleParams } from '@/i18n/page';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('meta.forgotTitle'), robots: { index: false, follow: false } };
}

export default async function ForgotPasswordPage({ params }: LocaleParams) {
  await initPage(params);
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <ForgotPasswordPanel />
      <AuthShowcase />
    </div>
  );
}
