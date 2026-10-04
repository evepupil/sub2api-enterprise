'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { ConsolePage } from '@/components/console/console-page';
import { ConfirmDialog } from '@/components/console/dialog';
import { RefreshButton } from '@/components/console/refresh-button';
import { useRouter } from '@/i18n/navigation';
import { formatUsd } from '@/lib/console';
import { useLoadable } from '@/lib/console/live/loadable';
import {
  actOnQuotaRequest,
  createInvitation,
  disableInvitation,
  fetchDefaultQuota,
  fetchOrgSummary,
  updateMember,
} from '@/lib/console/live/org-client';
import type {
  OrgErrorReason,
  OrgInvitation,
  OrgMember,
  OrgMemberStatus,
  QuotaRequest,
} from '@/lib/console/live/org-types';

import { OrgGrantDialog, OrgSplitDialog } from './organization-batch-dialogs';
import { useOrgInvitations, useOrgMembers, useOrgRequests } from './organization-hooks';
import { OrgInvitations } from './organization-invitations';
import { OrgQuotaDialog, OrgRenameDialog } from './organization-member-dialogs';
import { OrgMembers } from './organization-members';
import { memberLabel } from './organization-model';
import { OrgRequests } from './organization-requests';
import {
  OrgDefaultQuotaDialog,
  OrgPolicyDialog,
  OrgRejectDialog,
} from './organization-settings-dialogs';

/** 当前打开的弹窗：同一时刻只有一个，行上的弹窗带着那一行 */
type OrgDialog =
  | { kind: 'none' }
  | { kind: 'rename'; member: OrgMember }
  | { kind: 'quota'; member: OrgMember }
  | { kind: 'disableMember'; member: OrgMember }
  | { kind: 'grant' }
  | { kind: 'split' }
  | { kind: 'defaultQuota' }
  | { kind: 'policy' }
  | { kind: 'approve'; request: QuotaRequest }
  | { kind: 'reject'; request: QuotaRequest }
  | { kind: 'disableInvitation'; invitation: OrgInvitation };

/**
 * 组织管理员看到的组织页（照 sub2api 原来的组织管理）：上方左边是配额申请（审批、申请设置），
 * 右边是邀请码（创建、复制、停用）；下方是成员表（改名、设置配额、停用启用、勾选后周期发放或平分上限，
 * 以及新成员默认配额）。改动成功后只重读受影响的区块；右上角「刷新」重读整页。
 */
export function OrganizationAdmin({ fallbackName }: { fallbackName: string }) {
  const t = useTranslations('consoleOrg');
  const router = useRouter();
  const [reloadKey, setReloadKey] = useState(0);
  const [defaultVersion, setDefaultVersion] = useState(0);
  const [dialog, setDialog] = useState<OrgDialog>({ kind: 'none' });
  const [memberError, setMemberError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const summary = useLoadable(`summary|${reloadKey}`, (signal) => fetchOrgSummary(signal));
  const defaultQuota = useLoadable(`default|${reloadKey}|${defaultVersion}`, (signal) =>
    fetchDefaultQuota(signal),
  );
  const members = useOrgMembers(reloadKey);
  const requests = useOrgRequests(reloadKey);
  const invitations = useOrgInvitations(reloadKey);

  const organization = summary.data?.organization;
  // 登录时还是组织管理员、之后不是了（或已不在组织里）：和普通成员一样回用量页
  useEffect(() => {
    if (summary.data && !summary.data.organization?.isOwner) router.replace('/console/usage');
  }, [summary.data, router]);

  const failure = (reason: OrgErrorReason) => t(`errors.action.${reason}`);
  const closeDialog = () => setDialog({ kind: 'none' });
  const reloadAll = () => {
    setMemberError(null);
    setRequestError(null);
    setInvitationError(null);
    setReloadKey((value) => value + 1);
  };

  const setMemberStatus = async (member: OrgMember, status: OrgMemberStatus) => {
    setMemberError(null);
    members.mark(member.userId, true);
    const result = await updateMember(member.userId, { kind: 'status', status });
    members.mark(member.userId, false);
    if (!result.ok) setMemberError(failure(result.reason));
    members.refresh();
  };

  const approve = async (request: QuotaRequest) => {
    setRequestError(null);
    requests.mark(request.id, true);
    const result = await actOnQuotaRequest(request.id, 'approve');
    requests.mark(request.id, false);
    if (!result.ok) {
      // 成员已经不能加额度（改成不限额或被停用）：后端把申请自动作废了
      setRequestError(
        result.reason === 'request_ineligible'
          ? t('errors.approveIneligible')
          : failure(result.reason),
      );
    }
    requests.refresh();
    members.refresh();
  };

  const createCode = async () => {
    if (creating) return;
    setInvitationError(null);
    setCreating(true);
    const result = await createInvitation(invitations.validity);
    setCreating(false);
    if (!result.ok) setInvitationError(failure(result.reason));
    invitations.refresh();
  };

  const disableCode = async (invitation: OrgInvitation) => {
    setInvitationError(null);
    invitations.mark(invitation.id, true);
    const result = await disableInvitation(invitation.id);
    invitations.mark(invitation.id, false);
    if (!result.ok) setInvitationError(failure(result.reason));
    invitations.refresh();
  };

  const afterBatch = () => {
    members.clearSelection();
    members.refresh();
  };

  return (
    <ConsolePage
      id="organization"
      title={<span className="break-words">{organization?.name ?? fallbackName}</span>}
      actions={<RefreshButton onRefresh={reloadAll} />}
    >
      {organization?.status === 'disabled' ? (
        <div
          role="alert"
          data-org-suspended
          className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('suspended')}
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <OrgRequests
          policy={requests.policy}
          requests={requests.list}
          status={requests.status}
          onStatus={requests.onStatus}
          onSettings={() => setDialog({ kind: 'policy' })}
          onApprove={(request) => setDialog({ kind: 'approve', request })}
          onReject={(request) => setDialog({ kind: 'reject', request })}
          busy={requests.busy}
          error={requestError}
          onPage={requests.onPage}
          onPageSize={requests.onPageSize}
          onRetry={reloadAll}
        />
        <OrgInvitations
          invitations={invitations.list}
          validity={invitations.validity}
          onValidity={invitations.onValidity}
          creating={creating}
          onCreate={() => void createCode()}
          busy={invitations.busy}
          onDisable={(invitation) => setDialog({ kind: 'disableInvitation', invitation })}
          error={invitationError}
          onRetry={reloadAll}
        />
      </div>

      <OrgMembers
        members={members.list}
        searchText={members.searchText}
        onSearchText={members.onSearchText}
        status={members.status}
        onStatus={members.onStatus}
        selected={members.selectedIds}
        onSelectPage={members.selectPage}
        defaultQuota={defaultQuota.data}
        onDefaultQuota={() => setDialog({ kind: 'defaultQuota' })}
        onGrant={() => setDialog({ kind: 'grant' })}
        onSplit={() => setDialog({ kind: 'split' })}
        busy={members.busy}
        handlers={(member) => ({
          onToggleSelect: () => members.toggleSelect(member),
          onRename: () => setDialog({ kind: 'rename', member }),
          onQuota: () => setDialog({ kind: 'quota', member }),
          onToggleStatus: () =>
            member.status === 'active'
              ? setDialog({ kind: 'disableMember', member })
              : void setMemberStatus(member, 'active'),
        })}
        error={memberError}
        onPage={members.onPage}
        onPageSize={members.onPageSize}
        onRetry={reloadAll}
      />

      {dialog.kind === 'rename' ? (
        <OrgRenameDialog member={dialog.member} onClose={closeDialog} onDone={members.refresh} />
      ) : null}
      {dialog.kind === 'quota' ? (
        <OrgQuotaDialog member={dialog.member} onClose={closeDialog} onDone={members.refresh} />
      ) : null}
      {dialog.kind === 'grant' ? (
        <OrgGrantDialog
          userIds={[...members.selected.keys()]}
          onClose={closeDialog}
          onDone={afterBatch}
        />
      ) : null}
      {dialog.kind === 'split' ? (
        <OrgSplitDialog
          members={[...members.selected.values()]}
          onClose={closeDialog}
          onDone={afterBatch}
        />
      ) : null}
      {dialog.kind === 'defaultQuota' ? (
        <OrgDefaultQuotaDialog
          current={defaultQuota.data}
          onClose={closeDialog}
          onDone={() => {
            setDefaultVersion((value) => value + 1);
            members.refresh();
          }}
        />
      ) : null}
      {dialog.kind === 'policy' ? (
        <OrgPolicyDialog
          current={requests.policy.data}
          onClose={closeDialog}
          onDone={() => {
            requests.refreshPolicy();
            requests.refresh();
          }}
        />
      ) : null}
      {dialog.kind === 'reject' ? (
        <OrgRejectDialog request={dialog.request} onClose={closeDialog} onDone={requests.refresh} />
      ) : null}
      <ConfirmDialog
        id="org-disable-member"
        open={dialog.kind === 'disableMember'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={
          <span className="break-words">
            {t('disableMember.title', {
              name: dialog.kind === 'disableMember' ? memberLabel(dialog.member) : '',
            })}
          </span>
        }
        description={t('disableMember.description')}
        confirmLabel={t('members.actions.disable')}
        onConfirm={() => {
          if (dialog.kind === 'disableMember') void setMemberStatus(dialog.member, 'disabled');
        }}
      />
      <ConfirmDialog
        id="org-approve"
        open={dialog.kind === 'approve'}
        tone="default"
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={t('requests.approveTitle')}
        description={
          dialog.kind === 'approve'
            ? t('requests.approveDescription', {
                name: memberLabel(dialog.request),
                amount: formatUsd(dialog.request.amount),
              })
            : null
        }
        confirmLabel={t('requests.approve')}
        onConfirm={() => {
          if (dialog.kind === 'approve') void approve(dialog.request);
        }}
      />
      <ConfirmDialog
        id="org-disable-invitation"
        open={dialog.kind === 'disableInvitation'}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={t('invitations.disableTitle')}
        description={t('invitations.disableDescription')}
        confirmLabel={t('invitations.disable')}
        onConfirm={() => {
          if (dialog.kind === 'disableInvitation') void disableCode(dialog.invitation);
        }}
      />
    </ConsolePage>
  );
}
