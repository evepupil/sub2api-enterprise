'use client';

import { Gift } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Table, Td, Th, Tr } from '@/components/console/data-table';
import { EmptyState } from '@/components/console/empty-state';
import { Panel } from '@/components/console/panel';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { formatUsd, INVITE_PROGRAM, type Invitee, type InviteeStatus } from '@/lib/console';

/** 状态徽标：未充值灰、冻结中黄、已到账绿 */
const STATUS_TONES: Record<InviteeStatus, BadgeTone> = {
  pending: 'neutral',
  frozen: 'warning',
  released: 'success',
};

/**
 * 邀请记录：每个被邀请人的打码邮箱、注册时间、返利期内的充值额、已产生的返利和返利状态。
 * 没有人被邀请时显示空状态。
 */
export function InviteInviteesTable({ invitees }: { invitees: readonly Invitee[] }) {
  const t = useTranslations('consoleInvite');

  return (
    <Panel id="invitees" title={t('invitees.title')} bodyClassName="p-0">
      {invitees.length === 0 ? (
        <EmptyState id="invitees" icon={Gift} title={t('invitees.empty')} bordered={false} />
      ) : (
        // 面板标题行下面没有内边距，表格自己留出上边距；圆角让最后一行的悬停底色不顶出面板的圆角
        <div
          data-table="invitees"
          className="relative mt-4 overflow-x-auto rounded-b-2xl border-t border-border"
        >
          <Table minWidth={680} aria-label={t('invitees.title')}>
            <thead>
              <tr>
                <Th className="pl-5">{t('invitees.columns.user')}</Th>
                <Th>{t('invitees.columns.registeredAt')}</Th>
                <Th align="right">
                  {t('invitees.columns.recharged', { days: INVITE_PROGRAM.windowDays })}
                </Th>
                <Th align="right">{t('invitees.columns.rebate')}</Th>
                <Th className="pr-5">{t('invitees.columns.status')}</Th>
              </tr>
            </thead>
            <tbody>
              {invitees.map((invitee) => (
                <Tr key={invitee.id} data-invitee-row={invitee.id}>
                  <Td className="whitespace-nowrap pl-5 font-mono text-xs">{invitee.email}</Td>
                  <Td className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {invitee.registeredAt}
                  </Td>
                  <Td align="right" className="whitespace-nowrap tabular-nums">
                    {formatUsd(invitee.rechargedUsd)}
                  </Td>
                  <Td align="right" className="whitespace-nowrap tabular-nums">
                    {formatUsd(invitee.rebateUsd)}
                  </Td>
                  <Td className="whitespace-nowrap pr-5">
                    <Badge tone={STATUS_TONES[invitee.status]}>
                      {t(`invitees.status.${invitee.status}`)}
                    </Badge>
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
