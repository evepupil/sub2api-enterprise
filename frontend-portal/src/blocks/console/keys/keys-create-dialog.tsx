'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { CopyButton } from '@/components/console/copy-button';
import { Dialog } from '@/components/console/dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { AppLocale } from '@/i18n/routing';
import type { EditionId } from '@/lib/catalog';
import { CURRENT_USER, ORGANIZATION } from '@/lib/console';

import { useDelayedRun } from './keys-delay';
import { KeyExpiryField, KeyNameField, KeyQuotaField } from './keys-form-fields';
import { useKeyForm } from './keys-form-state';
import { buildNewKey, groupLabel, type KeyDraft, type KeyRow } from './keys-model';
import { generateKeySecret } from './keys-secret';

const FORM_ID = 'create-key-form';

/** 提交后的加载时长，结束后才给出新密钥 */
const SUBMIT_DELAY_MS = 800;

const EMPTY_DRAFT: KeyDraft = { name: '', quotaMode: 'unlimited', quota: '', expiry: 'never' };

/** 默认通道取当前用户的默认通道；它不在组织授权的通道里时退到第一个可用通道 */
const DEFAULT_GROUP: EditionId = ORGANIZATION.groups.includes(CURRENT_USER.defaultGroup)
  ? CURRENT_USER.defaultGroup
  : (ORGANIZATION.groups[0] ?? CURRENT_USER.defaultGroup);

/**
 * 创建密钥弹窗，只在打开时挂载，所以每次打开都是一份空白草稿。
 * 提交成功后弹窗内容换成「密钥已创建」：完整密钥只在这里展示一次；
 * 弹窗关闭（点完成、关闭按钮、Esc 都算）时，新密钥才加进列表。
 */
export function KeysCreateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (row: KeyRow) => void;
}) {
  const t = useTranslations('consoleKeys');
  const tc = useTranslations('console');
  const locale = useLocale() as AppLocale;
  const { draft, errors, update, validate } = useKeyForm(EMPTY_DRAFT);
  const [group, setGroup] = useState<EditionId>(DEFAULT_GROUP);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<KeyRow | null>(null);
  const delay = useDelayedRun();

  const finish = () => {
    if (created) onCreated(created);
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !validate()) return;
    // 随机串在提交这一下里生成，加载结束后再展示
    const row = buildNewKey(draft, group, generateKeySecret());
    setSubmitting(true);
    delay(() => {
      setCreated(row);
      setSubmitting(false);
    }, SUBMIT_DELAY_MS);
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
        <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-5">
          <KeyNameField
            value={draft.name}
            error={errors.name}
            onChange={(name) => update({ name })}
          />
          <Field label={t('form.group')} htmlFor="key-group">
            <SegmentedControl
              name="key-group"
              value={group}
              onChange={setGroup}
              ariaLabel={t('form.group')}
              options={ORGANIZATION.groups.map((id) => ({
                value: id,
                label: groupLabel(id, locale),
              }))}
            />
          </Field>
          <KeyQuotaField
            mode={draft.quotaMode}
            amount={draft.quota}
            error={errors.quota}
            onModeChange={(quotaMode) => update({ quotaMode })}
            onAmountChange={(quota) => update({ quota })}
          />
          <KeyExpiryField value={draft.expiry} onChange={(expiry) => update({ expiry })} />
        </form>
      )}
    </Dialog>
  );
}
