import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { initPage, type LocaleParams } from '@/i18n/page';

/**
 * 官网页面的外壳：顶栏、主体、页脚。
 * 页脚在服务端取文案，布局和页面是各自独立渲染的，所以这里也要先登记一次语言，
 * 否则页脚会因为拿不到语言而让整页退成按请求渲染，不能静态生成。
 */
export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: LocaleParams['params'];
}) {
  await initPage(params);
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
