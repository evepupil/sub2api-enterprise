import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuthShowcase } from '@/blocks/auth/auth-showcase';
import { GoogleCompletePanel } from '@/blocks/auth/google-complete-panel';
import { initPage, type LocaleParams } from '@/i18n/page';

/** 谷歌登录的新用户完成注册：官网服务器在谷歌回调后把新用户送到这里 */
export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('meta.googleCompleteTitle'), robots: { index: false, follow: false } };
}

export default async function GoogleCompletePage({ params }: LocaleParams) {
  await initPage(params);
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <GoogleCompletePanel />
      <AuthShowcase />
    </div>
  );
}
