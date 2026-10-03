import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuthShowcase } from '@/blocks/auth/auth-showcase';
import { RegisterPanel } from '@/blocks/auth/register-panel';
import { initPage, type LocaleParams } from '@/i18n/page';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('meta.registerTitle') };
}

export default async function RegisterPage({ params }: LocaleParams) {
  await initPage(params);
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <RegisterPanel />
      <AuthShowcase />
    </div>
  );
}
