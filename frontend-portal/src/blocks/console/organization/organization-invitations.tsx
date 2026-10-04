'use client';

import { Ban, Inbox, Plus, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/console/button';
import { CONTROL_BUTTON } from '@/components/console/control-button';
import { CopyButton } from '@/components/console/copy-button';
import { EmptyState } from '@/components/console/empty-state';
import { Panel } from '@/components/console/panel';
import { Select } from '@/components/console/select';
import { Skeleton } from '@/components/console/skeleton';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import type { Loadable } from '@/lib/console/live/loadable';
import {
  INVITATION_VALIDITY_DAYS,
  invitationStatus,
  inviteLink,
  type InvitationValidity,
} from '@/lib/console/live/org-rules';
import type { OrgInvitation, OrgInvitationStatus } from '@/lib/console/live/org-types';

import type { InvitationsSnapshot } from './organization-hooks';
import { minuteOf, OrgIconButton, OrgPanelError } from './organization-shared';

/** 只有还能用的邀请码是绿色，用过、停用、过期的都是灰色 */
const STATUS_TONE: Record<OrgInvitationStatus, BadgeTone> = {
  unused: 'success',
  used: 'neutral',
  disabled: 'neutral',
  expired: 'neutral',
};

/**
 * 组织邀请码（组织管理员）：标题行选有效期、创建邀请码；每个邀请码写创建时间、有效期与状态，
 * 有效、已使用的可以复制邀请码和邀请链接（打开就是官网注册页，邀请码已经填好），有效的可以停用（要确认）。
 * 列表太长时在区块里滚动，不把下面的成员表挤得太远。
 */
export function OrgInvitations({
  invitations,
  validity,
  onValidity,
  creating,
  onCreate,
  busy,
  onDisable,
  error,
  onRetry,
}: {
  invitations: Loadable<InvitationsSnapshot>;
  validity: InvitationValidity;
  onValidity: (value: InvitationValidity) => void;
  creating: boolean;
  onCreate: () => void;
  busy: ReadonlySet<number>;
  onDisable: (invitation: OrgInvitation) => void;
  /** 创建、停用失败时的一句话 */
  error: string | null;
  onRetry: () => void;
}) {
  const t = useTranslations('consoleOrg');
  const snapshot = invitations.data;

  let body: React.ReactNode;
  if (invitations.error && snapshot === null) {
    body = (
      <EmptyState
        id="org-invitations-error"
        icon={TriangleAlert}
        bordered={false}
        title={t('loadError.title')}
        action={
          <Button variant="secondary" onClick={onRetry}>
            {t('loadError.retry')}
          </Button>
        }
      />
    );
  } else if (snapshot === null) {
    body = <Skeleton className="h-24" />;
  } else if (snapshot.items.length === 0) {
    body = (
      <EmptyState
        id="org-invitations"
        icon={Inbox}
        bordered={false}
        title={t('invitations.empty')}
      />
    );
  } else {
    body = (
      <ul className="-mx-5 max-h-96 divide-y divide-border overflow-y-auto px-5">
        {snapshot.items.map((invitation) => {
          const status = invitationStatus(invitation, snapshot.nowMs);
          const copyable = status === 'unused' || status === 'used';
          return (
            <li
              key={invitation.id}
              data-org-invitation={invitation.code}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <code className="block break-all text-sm font-semibold text-foreground">
                  {invitation.code}
                </code>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-subtle-foreground">
                  <span>{t('invitations.created', { date: minuteOf(invitation.createdAt) })}</span>
                  <span>
                    {invitation.expiresAt
                      ? t('invitations.expires', { date: minuteOf(invitation.expiresAt) })
                      : t('invitations.forever')}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Badge
                  tone={STATUS_TONE[status]}
                  data-org-invitation-status={status}
                  className="mr-1"
                >
                  {t(`invitations.status.${status}`)}
                </Badge>
                {copyable ? (
                  <>
                    <CopyButton
                      name="org-code"
                      value={invitation.code}
                      label={t('invitations.copyCode')}
                    />
                    <CopyButton
                      name="org-link"
                      value={inviteLink(snapshot.origin, invitation.code)}
                      label={t('invitations.copyLink')}
                    />
                  </>
                ) : null}
                {status === 'unused' ? (
                  <OrgIconButton
                    icon={Ban}
                    tone="danger"
                    label={t('invitations.disable')}
                    data-org-invitation-disable={invitation.id}
                    disabled={busy.has(invitation.id)}
                    onClick={() => onDisable(invitation)}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Panel
      id="org-invitations"
      title={t('invitations.title')}
      actions={
        <>
          <Select
            name="org-invite-validity"
            value={String(validity)}
            onChange={(value) => onValidity(Number(value) as InvitationValidity)}
            options={INVITATION_VALIDITY_DAYS.map((days) => ({
              value: String(days),
              label: t(`invite.validity.${days}`),
            }))}
            ariaLabel={t('invite.validityLabel')}
            className="w-32"
          />
          <Button className={CONTROL_BUTTON} loading={creating} onClick={onCreate} data-org-invite>
            <Plus aria-hidden />
            {t('invite.create')}
          </Button>
        </>
      }
      bodyClassName="space-y-3"
    >
      <OrgPanelError message={error} />
      {body}
    </Panel>
  );
}
