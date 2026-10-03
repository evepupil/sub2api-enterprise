import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { NotFoundView } from '@/blocks/misc/not-found-view';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { initPage, type LocaleParams } from '@/i18n/page';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await initPage(params);
  const t = await getTranslations({ locale, namespace: 'misc' });
  return { title: t('meta.notFoundTitle') };
}

/** 语言前缀下找不到页面时显示：保留顶栏和页脚，中间换成 404 内容。 */
export default function LocaleNotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <NotFoundView />
      </main>
      <SiteFooter />
    </>
  );
}
