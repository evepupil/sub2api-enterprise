'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Button } from '@/components/console/button';
import { ConsolePage } from '@/components/console/console-page';
import { EmptyState } from '@/components/console/empty-state';
import { Skeleton } from '@/components/console/skeleton';
import { useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/session/session-provider';

import { OrganizationAdmin } from './organization-admin';

/**
 * 组织页只给组织管理员（组织创建者）：个人用户、普通成员直接打开地址时回用量页
 * （普通成员的组织配额与申请在用量页）。读当前用户期间显示占位块，读不到时可以重试。
 */
export function OrganizationPage() {
  const t = useTranslations('consoleOrg');
  const { status, user } = useSession();
  const router = useRouter();
  const organization = user?.organization ?? null;
  const owner = organization?.isOwner === true;

  useEffect(() => {
    if (status === 'authenticated' && !owner) router.replace('/console/usage');
  }, [status, owner, router]);

  if (status === 'authenticated' && organization && owner) {
    return <OrganizationAdmin fallbackName={organization.name} />;
  }
  return (
    <ConsolePage id="organization" title={t('meta.title')}>
      {status === 'unavailable' ? (
        <EmptyState
          id="organization-error"
          icon={TriangleAlert}
          title={t('loadError.title')}
          action={
            <Button variant="secondary" onClick={() => window.location.reload()}>
              {t('loadError.retry')}
            </Button>
          }
        />
      ) : (
        <div data-org-loading className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      )}
    </ConsolePage>
  );
}
