import type { Metadata } from 'next';

import { HelpView } from '@/features/help/help-view';
import { PublicFrame } from '@/features/public/public-frame';
import { getPublicSite } from '@/lib/api/public-server';

/** 匿名公开数据不参与构建期静态化。 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '帮助中心',
};

export default async function HelpPage() {
  const site = await getPublicSite();

  return (
    <PublicFrame site={site} activePath="/help">
      <div className="py-8">
        <HelpView settings={site.settings} />
      </div>
    </PublicFrame>
  );
}
