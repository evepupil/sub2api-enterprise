'use client';

import { Gift, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/console/button';
import { ConsolePage } from '@/components/console/console-page';
import { EmptyState } from '@/components/console/empty-state';
import { Panel } from '@/components/console/panel';
import { Skeleton } from '@/components/console/skeleton';
import { useAffiliate } from '@/lib/console/live/use-affiliate';

import { InviteInviteesTable } from './invite-invitees-table';
import { InviteLinkPanel } from './invite-link-panel';

/**
 * 邀请返利页（接 sub2api 的邀请返利，返利由后端自动进余额）：邀请链接与规则、三项统计，下面是邀请记录。
 * 后台没开邀请返利时侧栏不显示入口；直接打开这页时显示没开启。取不到时可以重试。
 */
export function InvitePage() {
  const t = useTranslations('consoleInvite');
  const [reloadKey, setReloadKey] = useState(0);
  const live = useAffiliate(reloadKey);
  const reload = () => setReloadKey((key) => key + 1);
  const state = live.state;

  return (
    <ConsolePage id="invite" title={t('meta.title')}>
      {state === null && live.error !== null ? (
        <EmptyState
          id="invite-error"
          icon={TriangleAlert}
          title={live.error === 'too_many' ? t('errors.tooMany') : t('errors.unavailable')}
          action={
            <Button variant="secondary" onClick={reload} data-invite-retry>
              {t('errors.retry')}
            </Button>
          }
        />
      ) : state === null ? (
        <Panel id="invite-loading">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-4 h-16 w-2/3" />
          <Skeleton className="mt-6 h-20 w-full" />
        </Panel>
      ) : !state.enabled ? (
        <EmptyState id="invite-disabled" icon={Gift} title={t('disabled')} />
      ) : (
        <>
          <InviteLinkPanel detail={state.detail} />
          <InviteInviteesTable detail={state.detail} />
        </>
      )}
    </ConsolePage>
  );
}
