'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/console/button';
import { ConfirmDialog, Dialog } from '@/components/console/dialog';
import { Select } from '@/components/console/select';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { actOnQuotaRequest, saveDefaultQuota, savePolicy } from '@/lib/console/live/org-client';
import { NOTE_MAX, noteTooLong } from '@/lib/console/live/org-rules';
import type {
  OrgDefaultQuota,
  OrgErrorReason,
  QuotaRequest,
  QuotaRequestMode,
  QuotaRequestPolicy,
} from '@/lib/console/live/org-types';

import { OrgFailure } from './organization-member-dialogs';
import {
  parsePeriodic,
  policyOf,
  type PeriodicDraft,
  type PeriodicError,
} from './organization-model';
import { OrgAmountInput, OrgPeriodicFields } from './organization-periodic-fields';

/** 勾选项：原生勾选框 + 一行字 */
function CheckRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-foreground">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-[var(--foreground)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

/**
 * 新成员默认配额：每期金额、周期天数（周期从加入时刻算起）；可以顺带发给现有没配周期配额的成员（默认勾上）、
 * 覆盖已配过的成员（默认不勾）。已开启时左下角可以关闭（要确认）。
 */
export function OrgDefaultQuotaDialog({
  current,
  onClose,
  onDone,
}: {
  current: OrgDefaultQuota | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const enabled = current?.enabled === true;
  const [draft, setDraft] = useState<PeriodicDraft>({
    amount: enabled && current?.amount !== null ? String(current?.amount) : '',
    periodDays: enabled && current?.periodDays !== null ? String(current?.periodDays) : '',
    immediate: true,
    startAt: '',
  });
  const [syncUnconfigured, setSyncUnconfigured] = useState(true);
  const [syncConfigured, setSyncConfigured] = useState(false);
  const [error, setError] = useState<PeriodicError | null>(null);
  const [failure, setFailure] = useState<OrgErrorReason | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const save = async (input: Parameters<typeof saveDefaultQuota>[0]) => {
    setSaving(true);
    setFailure(null);
    const result = await saveDefaultQuota(input);
    setSaving(false);
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }
    onDone();
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quota = parsePeriodic(draft);
    if (typeof quota === 'string') {
      setError(quota);
      return;
    }
    if (saving) return;
    void save({
      enabled: true,
      amount: quota.amount,
      periodDays: quota.periodDays,
      syncUnconfigured,
      syncConfigured,
    });
  };

  return (
    <Dialog
      id="org-default-quota"
      open
      initialFocus="org-default-amount"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('defaultQuota.title')}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {enabled ? (
            <Button
              variant="danger"
              className="mr-auto"
              disabled={saving}
              onClick={() => setConfirmOff(true)}
              data-org-default-off
            >
              {t('defaultQuota.disable')}
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" form="org-default-form" loading={saving} data-org-default-submit>
              {tc('actions.save')}
            </Button>
          </div>
        </div>
      }
    >
      <form id="org-default-form" noValidate onSubmit={submit} className="space-y-4">
        <OrgPeriodicFields
          idPrefix="org-default"
          draft={draft}
          error={error}
          withStart={false}
          onChange={(patch) => {
            setDraft((value) => ({ ...value, ...patch }));
            setError(null);
          }}
        />
        <p className="text-xs text-subtle-foreground">{t('defaultQuota.hint')}</p>
        <div className="space-y-2.5">
          <CheckRow
            id="org-default-sync-unconfigured"
            label={t('defaultQuota.syncUnconfigured')}
            checked={syncUnconfigured}
            onChange={setSyncUnconfigured}
          />
          <CheckRow
            id="org-default-sync-configured"
            label={t('defaultQuota.syncConfigured')}
            checked={syncConfigured}
            onChange={setSyncConfigured}
          />
        </div>
        <OrgFailure reason={failure} />
      </form>
      <ConfirmDialog
        id="org-default-off-confirm"
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title={t('defaultQuota.disableTitle')}
        description={t('defaultQuota.disableDescription')}
        confirmLabel={t('defaultQuota.disable')}
        onConfirm={() =>
          void save({
            enabled: false,
            amount: null,
            periodDays: null,
            syncUnconfigured: false,
            syncConfigured: false,
          })
        }
      />
    </Dialog>
  );
}

const MODES: readonly QuotaRequestMode[] = ['off', 'approve', 'auto'];

/** 申请设置：关闭 / 先审批再加 / 申请了就加，以及单次最低、最高 */
export function OrgPolicyDialog({
  current,
  onClose,
  onDone,
}: {
  current: QuotaRequestPolicy | null;
  onClose: () => void;
  onDone: (policy: QuotaRequestPolicy) => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const [mode, setMode] = useState<QuotaRequestMode>(current?.mode ?? 'off');
  const [min, setMin] = useState(
    current?.minAmount === null || !current ? '' : String(current.minAmount),
  );
  const [max, setMax] = useState(
    current?.maxAmount === null || !current ? '' : String(current.maxAmount),
  );
  const [rangeError, setRangeError] = useState(false);
  const [failure, setFailure] = useState<OrgErrorReason | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const policy = policyOf(mode, min, max);
    if (policy === 'range') {
      setRangeError(true);
      return;
    }
    if (saving) return;
    setSaving(true);
    setFailure(null);
    const result = await savePolicy(policy);
    setSaving(false);
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }
    onDone(result.data);
    onClose();
  };

  return (
    <Dialog
      id="org-policy"
      open
      size="sm"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('policy.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="org-policy-form" loading={saving} data-org-policy-submit>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form
        id="org-policy-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
      >
        <Field label={t('policy.mode')} htmlFor="org-policy-mode">
          <Select
            name="org-policy-mode"
            value={mode}
            onChange={(next) => {
              setMode(next);
              setRangeError(false);
            }}
            options={MODES.map((value) => ({ value, label: t(`policy.modes.${value}`) }))}
            ariaLabel={t('policy.mode')}
          />
        </Field>
        {mode === 'off' ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('policy.min')} htmlFor="org-policy-min">
              <OrgAmountInput
                id="org-policy-min"
                value={min}
                invalid={rangeError}
                onChange={(value) => {
                  setMin(value);
                  setRangeError(false);
                }}
              />
            </Field>
            <Field label={t('policy.max')} htmlFor="org-policy-max">
              <OrgAmountInput
                id="org-policy-max"
                value={max}
                invalid={rangeError}
                onChange={(value) => {
                  setMax(value);
                  setRangeError(false);
                }}
              />
            </Field>
          </div>
        )}
        {rangeError ? (
          <p role="alert" className="text-xs text-danger">
            {t('errors.range')}
          </p>
        ) : null}
        <OrgFailure reason={failure} />
      </form>
    </Dialog>
  );
}

/** 驳回一条配额申请，可以写备注（最多 500 个字） */
export function OrgRejectDialog({
  request,
  onClose,
  onDone,
}: {
  request: QuotaRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<OrgErrorReason | null>(null);
  const [saving, setSaving] = useState(false);
  const tooLong = noteTooLong(note);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || tooLong) return;
    setSaving(true);
    setFailure(null);
    const result = await actOnQuotaRequest(request.id, 'reject', note.trim());
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
      id="org-reject"
      open
      size="sm"
      initialFocus="org-reject-note"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('requests.rejectTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button
            type="submit"
            form="org-reject-form"
            variant="danger"
            loading={saving}
            data-org-reject-submit
          >
            {t('requests.reject')}
          </Button>
        </>
      }
    >
      <form
        id="org-reject-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
      >
        <Field
          label={t('requests.note')}
          htmlFor="org-reject-note"
          error={tooLong ? t('errors.noteTooLong') : null}
        >
          <Textarea
            id="org-reject-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            footer={`${Array.from(note.trim()).length} / ${NOTE_MAX}`}
          />
        </Field>
        <OrgFailure reason={failure} />
      </form>
    </Dialog>
  );
}
