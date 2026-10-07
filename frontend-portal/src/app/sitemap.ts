import type { MetadataRoute } from 'next';

import { sitemapEntries } from '@/lib/seo';
import { SITE } from '@/lib/site';

/** 站点地图：公开页的中英文地址（见 src/lib/seo.ts） */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(SITE.url);
}
