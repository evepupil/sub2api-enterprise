'use client';

import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CopyButton } from '@/components/console/copy-button';
import { Table, TableShell, Td, Th, Tr } from '@/components/console/data-table';
import { EmptyState } from '@/components/console/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/console/button';
import type { InvitationStatus, OrgInvitation } from '@/lib/console';

/** 有效的邀请码绿色；已使用和已过期都是正常结束，用灰色 */
const STATUS_TONE: Record<InvitationStatus, 'success' | 'neutral'> = {
  active: 'success',
  used: 'neutral',
  expired: 'neutral',
};

/**
 * 邀请码区：标题加邀请码表。只有「有效」的邀请码能作废，作废后状态变成已过期。
 */
export function OrganizationInvitations({
  invitations,
  onRevoke,
}: {
  invitations: readonly OrgInvitation[];
  onRevoke: (code: string) => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{t('invitations.title')}</h2>

      <TableShell id="invitations">
        {invitations.length === 0 ? (
          <EmptyState
            id="invitations"
            icon={UserPlus}
            title={t('invitations.empty')}
            bordered={false}
          />
        ) : (
          <Table minWidth={720}>
            <thead>
              <tr>
                <Th>{t('invitations.columns.code')}</Th>
                <Th>{t('invitations.columns.created')}</Th>
                <Th>{t('invitations.columns.expires')}</Th>
                <Th>{t('invitations.columns.status')}</Th>
                <Th>{t('invitations.columns.usedBy')}</Th>
                <Th sticky="right" align="right">
                  {tc('table.actions')}
                </Th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <Tr key={invitation.code} data-invitation-row={invitation.code}>
                  <Td>
                    <div className="flex items-center gap-1">
                      <span className="whitespace-nowrap font-mono text-sm text-foreground">
                        {invitation.code}
                      </span>
                      <CopyButton
                        name="invite-code"
                        value={invitation.code}
                        label={t('actions.copyCode')}
                      />
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {invitation.createdAt}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {invitation.expiresAt}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[invitation.status]}>
                      {t(`invitations.status.${invitation.status}`)}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">
                    <div className="max-w-56 truncate" title={invitation.usedBy ?? undefined}>
                      {invitation.usedBy ?? '—'}
                    </div>
                  </Td>
                  <Td sticky="right">
                    <div className="flex items-center justify-end">
                      {invitation.status === 'active' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          data-invitation-revoke
                          onClick={() => onRevoke(invitation.code)}
                        >
                          {t('actions.revoke')}
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableShell>
    </section>
  );
}
