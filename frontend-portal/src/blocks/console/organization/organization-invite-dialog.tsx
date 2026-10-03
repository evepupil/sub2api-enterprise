'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { CopyButton } from '@/components/console/copy-button';
import { Dialog } from '@/components/console/dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { OrgInvitation } from '@/lib/console';

import {
  buildInvitation,
  generateInviteCode,
  INVITE_EXPIRIES,
  inviteLink,
  type InviteExpiry,
} from './organization-invite';

/** 生成后展示的一行：小标签加一个带复制按钮的灰底框，长链接自动换行 */
function InviteValue({
  label,
  value,
  name,
  copyLabel,
}: {
  label: string;
  value: string;
  name: string;
  copyLabel: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex items-start gap-2 rounded-xl bg-muted p-3">
        <code className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">{value}</code>
        <CopyButton name={name} value={value} label={copyLabel} />
      </div>
    </div>
  );
}

/**
 * 邀请成员弹窗，只在打开时挂载：选有效期，点「生成邀请码」。
 * 生成是一下完成的，邀请码当场加进下面的邀请码表，弹窗里换成邀请码和邀请链接，各带复制按钮。
 */
export function OrganizationInviteDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (invitation: OrgInvitation) => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const [expiry, setExpiry] = useState<InviteExpiry>('7d');
  const [generated, setGenerated] = useState<OrgInvitation | null>(null);

  // 随机串只在点击这一下里生成
  const generate = () => {
    const invitation = buildInvitation(generateInviteCode(), expiry);
    setGenerated(invitation);
    onCreated(invitation);
  };

  return (
    <Dialog
      id="invite-member"
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('invite.title')}
      footer={
        generated ? (
          <Button data-invite-done onClick={onClose}>
            {t('actions.done')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {tc('actions.cancel')}
            </Button>
            <Button data-invite-generate onClick={generate}>
              {t('actions.generate')}
            </Button>
          </>
        )
      }
    >
      {generated ? (
        <div className="space-y-4">
          <InviteValue
            label={t('invite.code')}
            value={generated.code}
            name="new-invite-code"
            copyLabel={t('actions.copyCode')}
          />
          <InviteValue
            label={t('invite.link')}
            value={inviteLink(generated.code)}
            name="new-invite-link"
            copyLabel={t('actions.copyLink')}
          />
        </div>
      ) : (
        <Field label={t('invite.expiry')} htmlFor="invite-expiry">
          <SegmentedControl
            name="invite-expiry"
            value={expiry}
            onChange={setExpiry}
            ariaLabel={t('invite.expiry')}
            options={INVITE_EXPIRIES.map((value) => ({
              value,
              label: value === '7d' ? t('invite.days7') : t('invite.days30'),
            }))}
          />
        </Field>
      )}
    </Dialog>
  );
}
