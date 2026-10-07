import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuthShowcase } from '@/blocks/auth/auth-showcase';
import { LoginPanel } from '@/blocks/auth/login-panel';
import { initPage, type LocaleParams } from '@/i18n/page';
import { pageAlternates } from '@/lib/seo';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('meta.loginTitle'), alternates: pageAlternates(locale, '/login') };
}

export default async function LoginPage({ params }: LocaleParams) {
  await initPage(params);
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <LoginPanel />
      <AuthShowcase />
    </div>
  );
}
