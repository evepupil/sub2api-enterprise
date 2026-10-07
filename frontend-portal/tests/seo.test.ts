import { describe, expect, it } from 'vitest';

import { pageAlternates, SITEMAP_PATHS, sitemapEntries } from '@/lib/seo';

describe('搜索引擎', () => {
  it('规范地址按语言：中文不带前缀、英文带 /en，没有语言偏好时给中文', () => {
    expect(pageAlternates('zh', '/pricing')).toEqual({
      canonical: '/pricing',
      languages: { 'zh-CN': '/pricing', en: '/en/pricing', 'x-default': '/pricing' },
    });
    expect(pageAlternates('en', '/').canonical).toBe('/en');
    expect(pageAlternates('zh', '/').languages).toMatchObject({ en: '/en', 'zh-CN': '/' });
  });

  it('站点地图：每个公开页中英文各一条，互相标明对应语言，不含控制台', () => {
    const entries = sitemapEntries('https://codu.xyz');
    expect(entries).toHaveLength(SITEMAP_PATHS.length * 2);
    expect(entries.slice(0, 2).map((entry) => entry.url)).toEqual([
      'https://codu.xyz',
      'https://codu.xyz/en',
    ]);
    expect(
      entries.find((entry) => entry.url === 'https://codu.xyz/en/pricing')?.alternates,
    ).toEqual({
      languages: { 'zh-CN': 'https://codu.xyz/pricing', en: 'https://codu.xyz/en/pricing' },
    });
    expect(entries.some((entry) => entry.url.includes('/console'))).toBe(false);
  });
});
