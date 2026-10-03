'use client';

import { UserPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/console/dialog';
import { ConsolePage } from '@/components/console/console-page';
import { CONTROL_BUTTON } from '@/components/console/control-button';
import { Button } from '@/components/console/button';
import type { AppLocale } from '@/i18n/routing';
import { ORG_INVITATIONS, ORG_MEMBERS, type OrgInvitation, type OrgMember } from '@/lib/console';

import { OrganizationInfo } from './organization-info';
import { OrganizationInviteDialog } from './organization-invite-dialog';
import { OrganizationInvitations } from './organization-invitations';
import { OrganizationMemberQuotaDialog } from './organization-member-quota-dialog';
import { OrganizationMembers } from './organization-members';

/** 当前打开的弹窗：同一时刻只有一个，调整配额和移除都按成员编号找到那个人 */
type OrganizationDialog =
  | { kind: 'none' }
  | { kind: 'invite' }
  | { kind: 'quota'; id: string }
  | { kind: 'remove'; id: string };

/**
 * 组织页：组织信息与概况、成员表（调整配额、停用、移除）、邀请码表（生成、作废）。
 * 所有操作只改本页的列表状态，不发请求。
 */
export function OrganizationPage() {
  const t = useTranslations('consoleOrg');
  const locale = useLocale() as AppLocale;
  const [members, setMembers] = useState<readonly OrgMember[]>(ORG_MEMBERS);
  const [invitations, setInvitations] = useState<readonly OrgInvitation[]>(ORG_INVITATIONS);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<OrganizationDialog>({ kind: 'none' });

  const closeDialog = () => setDialog({ kind: 'none' });
  const target =
    dialog.kind === 'quota' || dialog.kind === 'remove'
      ? members.find((member) => member.id === dialog.id)
      : undefined;

  const updateMember = (id: string, patch: (member: OrgMember) => OrgMember) =>
    setMembers((current) => current.map((member) => (member.id === id ? patch(member) : member)));

  return (
    <ConsolePage
      id="organization"
      title={t('meta.title')}
      actions={
        <Button
          className={CONTROL_BUTTON}
          data-invite-member
          onClick={() => setDialog({ kind: 'invite' })}
        >
          <UserPlus aria-hidden />
          {t('actions.invite')}
        </Button>
      }
    >
      <OrganizationInfo members={members} />

      <OrganizationMembers
        members={members}
        query={query}
        onQueryChange={setQuery}
        onAdjustQuota={(id) => setDialog({ kind: 'quota', id })}
        onToggle={(id) =>
          updateMember(id, (member) => ({
            ...member,
            status: member.status === 'active' ? 'disabled' : 'active',
          }))
        }
        onRemove={(id) => setDialog({ kind: 'remove', id })}
      />

      <OrganizationInvitations
        invitations={invitations}
        onRevoke={(code) =>
          setInvitations((current) =>
            current.map((invitation) =>
              invitation.code === code ? { ...invitation, status: 'expired' } : invitation,
            ),
          )
        }
      />

      {dialog.kind === 'invite' ? (
        <OrganizationInviteDialog
          onClose={closeDialog}
          onCreated={(invitation) => setInvitations((current) => [invitation, ...current])}
        />
      ) : null}
      {dialog.kind === 'quota' && target ? (
        <OrganizationMemberQuotaDialog
          member={target}
          onClose={closeDialog}
          onSave={(id, quotaUsd) => updateMember(id, (member) => ({ ...member, quotaUsd }))}
        />
      ) : null}
      <ConfirmDialog
        id="remove-member"
        open={dialog.kind === 'remove' && target !== undefined}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={
          <span className="break-words">
            {t('remove.title', { name: target?.name[locale] ?? '' })}
          </span>
        }
        description={t('remove.description')}
        confirmLabel={t('actions.remove')}
        onConfirm={() => {
          if (target) setMembers((current) => current.filter((member) => member.id !== target.id));
        }}
      />
    </ConsolePage>
  );
}
