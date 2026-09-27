import type { Metadata } from 'next';

import { PublicFrame } from '@/features/public/public-frame';
import { StatusView } from '@/features/status/status-view';
import { getPublicSite, getPublicStatus } from '@/lib/api/public-server';

/** 匿名公开数据不参与构建期静态化。 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '服务状态',
};

export default async function StatusPage() {
  const [site, status] = await Promise.all([getPublicSite(), getPublicStatus()]);

  return (
    <PublicFrame site={site} activePath="/status">
      <div className="py-8">
        <StatusView result={status} />
      </div>
    </PublicFrame>
  );
}
