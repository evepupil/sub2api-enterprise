import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

import { ConsoleShell } from '@/components/console/shell/console-shell';
import { initPage, type LocaleParams } from '@/i18n/page';
import { CONSOLE_NAMESPACES, loadMessages, pickMessages } from '@/messages';

/** 控制台不进搜索引擎 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * 控制台外壳：换上控制台自己的一组文案（嵌套的文案上下文是整体替换，不会合并，
 * 所以这里要带上 common），再套侧边栏与公告条。页面本身仍静态生成。
 */
export default async function ConsoleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: LocaleParams['params'];
}) {
  const locale = await initPage(params);
  return (
    <NextIntlClientProvider messages={pickMessages(loadMessages(locale), CONSOLE_NAMESPACES)}>
      <ConsoleShell>{children}</ConsoleShell>
    </NextIntlClientProvider>
  );
}
