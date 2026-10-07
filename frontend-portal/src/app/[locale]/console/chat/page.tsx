import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { ChatPage } from '@/blocks/console/chat/chat-page';
import { initPage, type LocaleParams } from '@/i18n/page';
import { CONSOLE_FEATURES } from '@/lib/console/features';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'consoleChat' });
  return { title: t('meta.title') };
}

/** 对话页：功能开关关着时（首发，回复还是写死的）直接打开也跳回用量页，见 src/lib/console/features.ts */
export default async function Page({ params }: LocaleParams) {
  const locale = await initPage(params);
  if (!CONSOLE_FEATURES.chat) redirect(locale === 'en' ? '/en/console/usage' : '/console/usage');
  return <ChatPage />;
}
