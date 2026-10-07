import type { Metadata, MetadataRoute } from 'next';

import type { AppLocale } from '@/i18n/routing';

/** 进站点地图的公开页面（中文地址，英文加 /en 前缀）；控制台、接口、找回密码等不收录 */
export const SITEMAP_PATHS = [
  '/',
  '/catalog',
  '/pricing',
  '/channels',
  '/terms',
  '/privacy',
] as const;

const enPath = (path: string) => (path === '/' ? '/en' : `/en${path}`);

/**
 * 某页的规范地址与中英文对应地址：中文不带前缀、英文带 /en，没有语言偏好时给中文。
 * 地址是相对的，由根布局的 metadataBase 补成完整网址。
 */
export function pageAlternates(
  locale: AppLocale,
  path: string,
): NonNullable<Metadata['alternates']> {
  return {
    canonical: locale === 'zh' ? path : enPath(path),
    languages: { 'zh-CN': path, en: enPath(path), 'x-default': path },
  };
}

/** 站点地图：每个公开页的中英文两条，互相标明对应语言 */
export function sitemapEntries(origin: string): MetadataRoute.Sitemap {
  return SITEMAP_PATHS.flatMap((path) => {
    const languages = {
      'zh-CN': `${origin}${path === '/' ? '' : path}`,
      en: `${origin}${enPath(path)}`,
    };
    return [
      { url: languages['zh-CN'] || origin, alternates: { languages } },
      { url: languages.en, alternates: { languages } },
    ];
  });
}
