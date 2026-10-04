'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/console/button';
import { Dialog } from '@/components/console/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { updateMember } from '@/lib/console/live/org-client';
import { memberNameError, MEMBER_NAME_MAX } from '@/lib/console/live/org-rules';
import type { OrgErrorReason, OrgMember } from '@/lib/console/live/org-types';

import {
  memberLabel,
  quotaDraftOf,
  quotaUpdateOf,
  type PeriodicError,
  type QuotaDraft,
  type QuotaMode,
} from './organization-model';
import { OrgAmountInput, OrgPeriodicFields } from './organization-periodic-fields';

/** 弹窗最后一行的失败原因 */
export function OrgFailure({ reason }: { reason: OrgErrorReason | null }) {
  const t = useTranslations('consoleOrg');
  if (reason === null) return null;
  return (
    <p role="alert" data-org-error={reason} className="text-sm text-danger">
      {t(`errors.action.${reason}`)}
    </p>
  );
}

/** 改成员在组织里的名称（1–50 个字） */
export function OrgRenameDialog({
  member,
  onClose,
  onDone,
}: {
  member: OrgMember;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const [name, setName] = useState(member.displayName);
  const [error, setError] = useState<'required' | 'tooLong' | null>(null);
  const [failure, setFailure] = useState<OrgErrorReason | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = memberNameError(name);
    setError(problem);
    if (problem || saving) return;
    setSaving(true);
    setFailure(null);
    const result = await updateMember(member.userId, { kind: 'name', displayName: name.trim() });
    setSaving(false);
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }
    onDone();
    onClose();
  };

  return (
    <Dialog
      id="org-rename"
      open
      size="sm"
      initialFocus="org-member-name"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('rename.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="org-rename-form" loading={saving} data-org-rename-submit>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form
        id="org-rename-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
      >
        <Field
          label={t('rename.label')}
          htmlFor="org-member-name"
          error={
            error === 'required'
              ? t('errors.nameRequired')
              : error === 'tooLong'
                ? t('errors.nameTooLong')
                : null
          }
        >
          <Input
            id="org-member-name"
            autoComplete="off"
            maxLength={MEMBER_NAME_MAX * 2}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'org-member-name-error' : undefined}
          />
        </Field>
        <OrgFailure reason={failure} />
      </form>
    </Dialog>
  );
}

const QUOTA_MODES: readonly QuotaMode[] = ['unlimited', 'fixed', 'periodic'];

/**
 * 设置一个成员的配额：不限额、固定累计上限（0 表示不让消费）、周期配额（每期金额、周期、立即或定时生效）。
 * 成员已有周期配额、又切到别的方式时，提前说明保存会清掉原来的周期配额。
 */
export function OrgQuotaDialog({
  member,
  onClose,
  onDone,
}: {
  member: OrgMember;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const [draft, setDraft] = useState<QuotaDraft>(() => quotaDraftOf(member));
  const [error, setError] = useState<PeriodicError | null>(null);
  const [failure, setFailure] = useState<OrgErrorReason | null>(null);
  const [saving, setSaving] = useState(false);

  const change = (patch: Partial<QuotaDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const update = quotaUpdateOf(draft);
    if (typeof update === 'string') {
      setError(update);
      return;
    }
    setSaving(true);
    setFailure(null);
    const result = await updateMember(member.userId, update);
    setSaving(false);
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }
    onDone();
    onClose();
  };

  return (
    <Dialog
      id="org-quota"
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('quota.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="org-quota-form" loading={saving} data-org-quota-submit>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form
        id="org-quota-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="space-y-5"
      >
        <p className="break-all text-sm text-muted-foreground">{memberLabel(member)}</p>
        <SegmentedControl
          name="org-quota-mode"
          value={draft.mode}
          onChange={(mode) => change({ mode })}
          ariaLabel={t('quota.mode')}
          options={QUOTA_MODES.map((mode) => ({ value: mode, label: t(`quota.modes.${mode}`) }))}
        />
        {draft.mode === 'fixed' ? (
          <Field
            label={t('quota.amount')}
            htmlFor="org-quota-amount"
            hint={t('quota.fixedHint')}
            error={error === 'amount' ? t('errors.amount') : null}
          >
            <OrgAmountInput
              id="org-quota-amount"
              value={draft.amount}
              invalid={error === 'amount'}
              onChange={(amount) => change({ amount })}
            />
          </Field>
        ) : null}
        {draft.mode === 'periodic' ? (
          <OrgPeriodicFields
            idPrefix="org-quota"
            draft={draft}
            error={error}
            withStart
            onChange={change}
          />
        ) : null}
        {member.quota !== null && draft.mode !== 'periodic' ? (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
            {t('quota.switchClears')}
          </p>
        ) : null}
        <OrgFailure reason={failure} />
      </form>
    </Dialog>
  );
}
