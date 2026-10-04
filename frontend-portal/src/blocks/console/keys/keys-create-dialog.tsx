'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/console/button';
import { CopyButton } from '@/components/console/copy-button';
import { Dialog } from '@/components/console/dialog';
import { createKey } from '@/lib/console/live/keys-client';
import type { KeyErrorReason, KeyGroupOption, LiveKey } from '@/lib/console/live/keys-types';

import {
  KeyCustomKeyField,
  KeyExpiryField,
  KeyGroupField,
  KeyIpField,
  KeyNameField,
  KeyQuotaField,
  KeyRateLimitField,
} from './keys-form-fields';
import { useKeyForm } from './keys-form-state';
import { emptyDraft, toCreateInput } from './keys-model';

const FORM_ID = 'create-key-form';

/**
 * 创建密钥弹窗，只在打开时挂载，所以每次打开都是一份空白草稿。表单照 sub2api：名称、分组必填，
 * 自定义密钥、IP 限制、限速、有效期用开关打开，额度不填表示不限。
 * 创建成功后弹窗内容换成「密钥已创建」：完整密钥只在这里显示一次；关掉弹窗时通知列表重新读取。
 */
export function KeysCreateDialog({
  groups,
  groupsUnavailable,
  today,
  onClose,
  onCreated,
}: {
  groups: readonly KeyGroupOption[];
  groupsUnavailable: boolean;
  /** 北京时间的今天，有效期从它算 */
  today: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations('consoleKeys');
  const tc = useTranslations('console');
  const { draft, errors, update, validate } = useKeyForm(
    emptyDraft(today, groups),
    'create',
    today,
  );
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<KeyErrorReason | null>(null);
  const [created, setCreated] = useState<LiveKey | null>(null);

  const finish = () => {
    if (created) onCreated();
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    setFailure(null);
    const result = await createKey(toCreateInput(draft, today));
    setSubmitting(false);
    if (result.ok) setCreated(result.data);
    else setFailure(result.reason);
  };

  return (
    <Dialog
      initialFocus="key-name"
      id="create-key"
      open
      onOpenChange={(open) => {
        if (!open) finish();
      }}
      title={created ? t('create.doneTitle') : t('create.title')}
      footer={
        created ? (
          <Button data-create-done onClick={finish}>
            {t('actions.done')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={finish}>
              {tc('actions.cancel')}
            </Button>
            {/* 按钮在表单外的底部栏里，用 form 属性指回表单，回车提交也走同一条路 */}
            <Button type="submit" form={FORM_ID} data-create-submit loading={submitting}>
              {t('create.submit')}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="flex items-start gap-2 rounded-xl bg-muted p-4">
          <code
            data-new-key-secret
            className="min-w-0 flex-1 break-all font-mono text-xs text-foreground"
          >
            {created.secret}
          </code>
          <CopyButton name="new-key" value={created.secret} label={t('actions.copySecret')} />
        </div>
      ) : (
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
            unavailable={groupsUnavailable}
            error={errors.group}
            onChange={(groupId) => update({ groupId })}
          />
          <KeyCustomKeyField
            enabled={draft.useCustomKey}
            value={draft.customKey}
            error={errors.customKey}
            onToggle={(useCustomKey) => update({ useCustomKey })}
            onChange={(customKey) => update({ customKey })}
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
          />
          <KeyRateLimitField
            enabled={draft.rateLimit}
            values={draft}
            errors={errors}
            onToggle={(rateLimit) => update({ rateLimit })}
            onChange={update}
          />
          <KeyExpiryField
            enabled={draft.expiry}
            date={draft.expiryDate}
            today={today}
            mode="create"
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
      )}
    </Dialog>
  );
}
