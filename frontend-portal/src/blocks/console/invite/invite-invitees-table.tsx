'use client';

import { Gift } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Table, Td, Th, Tr } from '@/components/console/data-table';
import { EmptyState } from '@/components/console/empty-state';
import { Panel } from '@/components/console/panel';
import { formatDateTimeShort, formatUsd } from '@/lib/console';
import type { AffiliateDetail } from '@/lib/console/live/invite-types';
import { inviteesTruncated } from '@/lib/console/live/invite-view';
import { cn } from '@/lib/utils';

/**
 * 邀请记录：每个被邀请人的打码邮箱（没有邮箱时显示用户名）、注册时间和给你带来的返利。
 * 后端只给最近 100 个，总人数更多时标题旁写「只显示最近 N 位」。没有人被邀请时显示空状态。
 */
export function InviteInviteesTable({ detail }: { detail: AffiliateDetail }) {
  const t = useTranslations('consoleInvite');
  const invitees = detail.invitees;

  return (
    <Panel
      id="invitees"
      title={t('invitees.title')}
      actions={
        inviteesTruncated(detail) ? (
          <span className="text-xs text-subtle-foreground">
            {t('invitees.partial', { count: invitees.length })}
          </span>
        ) : undefined
      }
      bodyClassName="p-0"
    >
      {invitees.length === 0 ? (
        <EmptyState id="invitees" icon={Gift} title={t('invitees.empty')} bordered={false} />
      ) : (
        // 面板标题行下面没有内边距，表格自己留出上边距；圆角让最后一行的悬停底色不顶出面板的圆角
        <div
          data-table="invitees"
          className="relative mt-4 overflow-x-auto rounded-b-2xl border-t border-border"
        >
          <Table minWidth={520} aria-label={t('invitees.title')}>
            <thead>
              <tr>
                <Th className="pl-5">{t('invitees.columns.user')}</Th>
                <Th>{t('invitees.columns.joinedAt')}</Th>
                <Th align="right" className="pr-5">
                  {t('invitees.columns.rebate')}
                </Th>
              </tr>
            </thead>
            <tbody>
              {invitees.map((invitee) => (
                <Tr key={invitee.id} data-invitee-row={invitee.id}>
                  <Td className="whitespace-nowrap pl-5 font-mono text-xs">
                    {invitee.email !== '' ? invitee.email : invitee.username}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {invitee.joinedAt === null ? '—' : formatDateTimeShort(invitee.joinedAt)}
                  </Td>
                  <Td
                    align="right"
                    className={cn(
                      'whitespace-nowrap pr-5 tabular-nums',
                      invitee.rebateUsd > 0 ? 'text-success' : 'text-muted-foreground',
                    )}
                  >
                    {formatUsd(invitee.rebateUsd)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
