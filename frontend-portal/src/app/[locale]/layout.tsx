import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { Providers } from '@/components/providers';
import { routing } from '@/i18n/routing';
import { SITE } from '@/lib/site';
import { loadMessages, pickMessages, SITE_NAMESPACES } from '@/messages';

import '../globals.css';

/** 分享卡片大图 */
const OG_IMAGE = '/og.png';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'common' });
  return {
    title: { default: `${SITE.name} · ${t('meta.tagline')}`, template: `%s · ${SITE.name}` },
    description: t('meta.description'),
    // 分享到社交平台时的卡片：站名、语言与大图（public/og.png，1200×630）
    openGraph: {
      type: 'website',
      siteName: SITE.name,
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      images: [
        { url: OG_IMAGE, width: 1200, height: 630, alt: `${SITE.name} · ${t('meta.tagline')}` },
      ],
    },
    twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // 让本次渲染的服务端组件都能拿到语言，页面才能静态生成
  setRequestLocale(locale);

  return (
    <html
      lang={locale === 'zh' ? 'zh-CN' : 'en'}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground font-sans antialiased">
        {/* 浏览器里只带官网的文案；控制台布局会换成控制台自己的一组 */}
        <NextIntlClientProvider messages={pickMessages(loadMessages(locale), SITE_NAMESPACES)}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
