import type { Metadata } from 'next';

import { SessionCatalog } from '@/features/catalog/session-catalog';
import { PublicFrame } from '@/features/public/public-frame';
import { getPublicCatalog, getPublicSite } from '@/lib/api/public-server';

/** 匿名公开数据不参与构建期静态化。 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '模型与价格',
};

export default async function CatalogPage() {
  const [site, catalog] = await Promise.all([getPublicSite(), getPublicCatalog()]);

  return (
    <PublicFrame site={site} activePath="/catalog">
      <div className="py-8">
        <SessionCatalog result={catalog} />
      </div>
    </PublicFrame>
  );
}
