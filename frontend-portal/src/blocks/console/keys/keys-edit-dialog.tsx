'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/console/button';
import { ConfirmDialog, Dialog } from '@/components/console/dialog';
import { updateKey } from '@/lib/console/live/keys-client';
import type { KeyErrorReason, KeyGroupOption, LiveKey } from '@/lib/console/live/keys-types';

import {
  KeyExpiryField,
  KeyGroupField,
  KeyIpField,
  KeyNameField,
  KeyQuotaField,
  KeyRateLimitField,
} from './keys-form-fields';
import { useKeyForm } from './keys-form-state';
import { draftFromKey, toUpdateInput } from './keys-model';

const FORM_ID = 'edit-key-form';

type ResetKind = 'quota' | 'rate';

/**
 * 编辑密钥弹窗，只在打开时挂载。照 sub2api：名称、分组、IP 限制、额度、限速、有效期都能改；
 * 设了额度时可以把已用额度清零，设了限速时可以把限速用量清零（要先确认，确认后马上生效，不用点保存）。
 * 额度用完、已过期的密钥加了额度、清了已用额度或延了期，后端会自动恢复启用。
 */
export function KeysEditDialog({
  keyRow,
  groups,
  groupsUnavailable,
  today,
  onClose,
  onChanged,
}: {
  keyRow: LiveKey;
  groups: readonly KeyGroupOption[];
  groupsUnavailable: boolean;
  today: string;
  onClose: () => void;
  /** 保存或清零成功后通知列表重新读取 */
  onChanged: () => void;
}) {
  const t = useTranslations('consoleKeys');
  const tc = useTranslations('console');
  // 清零后用后端回的新数据刷新弹窗里的已用量；表单草稿不动
  const [current, setCurrent] = useState<LiveKey>(keyRow);
  const { draft, errors, update, validate } = useKeyForm(
    draftFromKey(keyRow, today),
    'edit',
    today,
  );
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<KeyErrorReason | null>(null);
  const [confirm, setConfirm] = useState<ResetKind | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    setFailure(null);
    const result = await updateKey(current.id, toUpdateInput(draft, current));
    setSaving(false);
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }
    onChanged();
    onClose();
  };

  const reset = async (kind: ResetKind) => {
    setFailure(null);
    const result = await updateKey(
      current.id,
      kind === 'quota' ? { resetQuota: true } : { resetRateUsage: true },
    );
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }
    setCurrent((before) => ({
      ...before,
      quotaUsed: result.data.quotaUsed,
      rateUsage: result.data.rateUsage,
      status: result.data.status,
    }));
    onChanged();
  };

  const hasRateLimit =
    current.rateLimits.h5 > 0 || current.rateLimits.d1 > 0 || current.rateLimits.d7 > 0;

  return (
    <Dialog
      id="edit-key"
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('edit.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} data-edit-submit loading={saving}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-5"
      >
        <KeyNameField
          value={draft.name}
          error={errors.name}
          onChange={(name) => update({ name })}
        />
        <KeyGroupField
          value={draft.groupId}
          groups={groups}
          current={current.group}
          unavailable={groupsUnavailable}
          error={errors.group}
          onChange={(groupId) => update({ groupId })}
        />
        <KeyIpField
          enabled={draft.ipLimit}
          whitelist={draft.ipWhitelist}
          blacklist={draft.ipBlacklist}
          errors={errors}
          onToggle={(ipLimit) => update({ ipLimit })}
          onChange={update}
        />
        <KeyQuotaField
          value={draft.quota}
          error={errors.quota}
          onChange={(quota) => update({ quota })}
          used={current.quota > 0 ? { used: current.quotaUsed, limit: current.quota } : undefined}
          onReset={() => setConfirm('quota')}
        />
        <KeyRateLimitField
          enabled={draft.rateLimit}
          values={draft}
          errors={errors}
          onToggle={(rateLimit) => update({ rateLimit })}
          onChange={update}
          usage={hasRateLimit ? current.rateUsage : undefined}
          onReset={() => setConfirm('rate')}
        />
        <KeyExpiryField
          enabled={draft.expiry}
          date={draft.expiryDate}
          today={today}
          mode="edit"
          error={errors.expiryDate}
          onToggle={(expiry) => update({ expiry })}
          onChange={(expiryDate) => update({ expiryDate })}
        />
        {failure ? (
          <p role="alert" data-key-error={failure} className="text-sm text-danger">
            {t(`errors.action.${failure}`)}
          </p>
        ) : null}
      </form>
      <ConfirmDialog
        id="reset-key-usage"
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        tone="default"
        title={confirm === 'rate' ? t('reset.rateTitle') : t('reset.quotaTitle')}
        description={confirm === 'rate' ? t('reset.rateDescription') : t('reset.quotaDescription')}
        confirmLabel={t('reset.confirm')}
        onConfirm={() => {
          if (confirm) void reset(confirm);
        }}
      />
    </Dialog>
  );
}
