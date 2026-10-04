'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Dialog } from '@/components/console/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/console/button';
import { Field } from '@/components/ui/field';
import type { AppLocale } from '@/i18n/routing';

import { useDelayedRun } from './keys-delay';
import { KeyExpiryField, KeyNameField, KeyQuotaField } from './keys-form-fields';
import { useKeyForm } from './keys-form-state';
import { applyKeyEdit, draftFromKey, groupLabel, type KeyRow } from './keys-model';

const FORM_ID = 'edit-key-form';

/** 保存后的加载时长，结束后才更新这一行并关闭弹窗 */
const SAVE_DELAY_MS = 800;

/**
 * 编辑密钥弹窗，只在打开时挂载：名称、额度、有效期可改。
 * 分组只读：密钥按所在分组的倍率计费，要换分组就新建一个密钥。
 */
export function KeysEditDialog({
  row,
  onClose,
  onSave,
}: {
  row: KeyRow;
  onClose: () => void;
  onSave: (row: KeyRow) => void;
}) {
  const t = useTranslations('consoleKeys');
  const tc = useTranslations('console');
  const locale = useLocale() as AppLocale;
  const { draft, errors, update, validate } = useKeyForm(draftFromKey(row));
  const [saving, setSaving] = useState(false);
  const delay = useDelayedRun();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    delay(() => {
      onSave(applyKeyEdit(row, draft));
      onClose();
    }, SAVE_DELAY_MS);
  };

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
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-5">
        <KeyNameField
          value={draft.name}
          error={errors.name}
          onChange={(name) => update({ name })}
        />
        <Field label={t('form.group')} htmlFor="key-group" hint={t('edit.groupHint')}>
          <div>
            <Badge tone="outline">{groupLabel(row.group, locale)}</Badge>
          </div>
        </Field>
        <KeyQuotaField
          mode={draft.quotaMode}
          amount={draft.quota}
          error={errors.quota}
          onModeChange={(quotaMode) => update({ quotaMode })}
          onAmountChange={(quota) => update({ quota })}
        />
        <KeyExpiryField
          value={draft.expiry}
          keepDate={row.expiresAt}
          onChange={(expiry) => update({ expiry })}
        />
      </form>
    </Dialog>
  );
}
