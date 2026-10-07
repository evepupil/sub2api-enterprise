import type { MetadataRoute } from 'next';

import { SITE } from '@/lib/site';

/** 搜索引擎规则：官网公开页都可收录，控制台和接口不收录 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/console', '/en/console', '/api/'] },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
