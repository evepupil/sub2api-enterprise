import { defineRouting } from 'next-intl/routing';

/**
 * 站点语言路由：中文为默认语言、地址不带前缀（/models），英文带 /en 前缀（/en/models）。
 * 不按浏览器语言自动跳转，访客通过顶栏的语言下拉切换。
 */
export const routing = defineRouting({
  locales: ['zh', 'en'],
  defaultLocale: 'zh',
  localePrefix: 'as-needed',
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
