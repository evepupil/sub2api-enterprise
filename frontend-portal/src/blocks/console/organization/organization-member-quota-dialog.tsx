'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Dialog } from '@/components/console/dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { AppLocale } from '@/i18n/routing';
import type { OrgMember } from '@/lib/console';

import { useDelayedRun } from './organization-delay';
import { parseQuota, QUOTA_MAX, QUOTA_MIN, type QuotaMode } from './organization-model';

const FORM_ID = 'member-quota-form';
const AMOUNT_ID = 'member-quota-amount';

/** 保存后的加载时长，结束后才更新这位成员并关闭弹窗 */
const SAVE_DELAY_MS = 800;

/**
 * 调整每月配额弹窗，只在打开时挂载：不限额，或自定义一个 1 到 100000 美元之间的金额。
 * 金额不合法时保存无效，错误标在输入框上。
 */
export function OrganizationMemberQuotaDialog({
  member,
  onClose,
  onSave,
}: {
  member: OrgMember;
  onClose: () => void;
  /** quotaUsd 为 null 表示不限额 */
  onSave: (id: string, quotaUsd: number | null) => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const locale = useLocale() as AppLocale;
  const [mode, setMode] = useState<QuotaMode>(member.quotaUsd === null ? 'unlimited' : 'custom');
  const [amount, setAmount] = useState(member.quotaUsd === null ? '' : String(member.quotaUsd));
  const [invalid, setInvalid] = useState(false);
  const [saving, setSaving] = useState(false);
  const delay = useDelayedRun();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const quota = mode === 'custom' ? parseQuota(amount) : null;
    if (mode === 'custom' && quota === null) {
      setInvalid(true);
      document.getElementById(AMOUNT_ID)?.focus();
      return;
    }
    setSaving(true);
    delay(() => {
      onSave(member.id, quota);
      onClose();
    }, SAVE_DELAY_MS);
  };

  const message = invalid ? t('errors.quotaRange', { min: QUOTA_MIN, max: QUOTA_MAX }) : null;

  return (
    <Dialog
      id="member-quota"
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={<span className="break-words">{t('quota.title', { name: member.name[locale] })}</span>}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} data-member-quota-save loading={saving}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        <SegmentedControl
          name="quota-mode"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setInvalid(false);
          }}
          ariaLabel={t('quota.modeLabel')}
          options={[
            { value: 'unlimited', label: t('quota.unlimited') },
            { value: 'custom', label: t('quota.custom') },
          ]}
        />
        {mode === 'custom' ? (
          <Field label={t('quota.amount')} htmlFor={AMOUNT_ID} error={message}>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle-foreground"
              >
                $
              </span>
              <Input
                id={AMOUNT_ID}
                name="quota"
                type="number"
                inputMode="decimal"
                min={QUOTA_MIN}
                max={QUOTA_MAX}
                step={1}
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setInvalid(false);
                }}
                aria-invalid={message ? true : undefined}
                aria-describedby={message ? `${AMOUNT_ID}-error` : undefined}
                className="pl-7"
              />
            </div>
          </Field>
        ) : null}
      </form>
    </Dialog>
  );
}
