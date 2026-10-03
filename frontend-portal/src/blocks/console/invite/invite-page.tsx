'use client';

import { useTranslations } from 'next-intl';

import { ConsolePage } from '@/components/console/console-page';
import { INVITEES, inviteStats } from '@/lib/console';

import { InviteInviteesTable } from './invite-invitees-table';
import { InviteLinkPanel } from './invite-link-panel';

/** 邀请数据是固定的占位数据，统计只算一次 */
const STATS = inviteStats(INVITEES);

/** 邀请返利页：邀请链接与返利规则、四项统计，下面是邀请记录。 */
export function InvitePage() {
  const t = useTranslations('consoleInvite');
  return (
    <ConsolePage id="invite" title={t('meta.title')}>
      <InviteLinkPanel stats={STATS} />
      <InviteInviteesTable invitees={INVITEES} />
    </ConsolePage>
  );
}
