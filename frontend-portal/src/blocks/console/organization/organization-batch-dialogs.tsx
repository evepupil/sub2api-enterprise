'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/console/button';
import { Dialog } from '@/components/console/dialog';
import { Field } from '@/components/ui/field';
import { formatUsd } from '@/lib/console';
import { batchMembers } from '@/lib/console/live/org-client';
import { parseAmount, splitAmounts } from '@/lib/console/live/org-rules';
import type { OrgErrorReason, OrgMember } from '@/lib/console/live/org-types';

import { OrgFailure } from './organization-member-dialogs';
import {
  EMPTY_PERIODIC,
  memberLabel,
  parsePeriodic,
  type PeriodicDraft,
  type PeriodicError,
} from './organization-model';
import { OrgAmountInput, OrgPeriodicFields } from './organization-periodic-fields';

/**
 * 平分上限：填一个总额，按勾选的人数平分，成为各自的固定累计上限。提交前列出每人分到多少
 * （除不尽的零头按成员 ID 从小到大补，和后端一致）。
 */
export function OrgSplitDialog({
  members,
  onClose,
  onDone,
}: {
  members: readonly OrgMember[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const [total, setTotal] = useState('');
  const [error, setError] = useState(false);
  const [failure, setFailure] = useState<OrgErrorReason | null>(null);
  const [saving, setSaving] = useState(false);

  const userIds = members.map((member) => member.userId);
  const shares = splitAmounts(userIds, parseAmount(total) ?? 0);
  const preview = [...shares.entries()].map(([userId, amount]) => ({
    userId,
    label: memberLabel(
      members.find((member) => member.userId === userId) ?? {
        displayName: '',
        email: String(userId),
      },
    ),
    amount,
  }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = parseAmount(total);
    if (amount === null) {
      setError(true);
      return;
    }
    if (saving) return;
    setSaving(true);
    setFailure(null);
    const result = await batchMembers({ kind: 'split', userIds, totalAmount: amount });
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
      id="org-split"
      open
      initialFocus="org-split-total"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('split.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="org-split-form" loading={saving} data-org-split-submit>
            {tc('actions.confirm')}
          </Button>
        </>
      }
    >
      <form
        id="org-split-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
      >
        <Field
          label={t('split.total')}
          htmlFor="org-split-total"
          hint={t('split.hint')}
          error={error ? t('errors.amount') : null}
        >
          <OrgAmountInput
            id="org-split-total"
            value={total}
            invalid={error}
            onChange={(value) => {
              setTotal(value);
              setError(false);
            }}
          />
        </Field>
        <ul
          data-org-split-preview
          className="divide-y divide-border rounded-md border border-border text-sm"
        >
          {preview.map((item) => (
            <li key={item.userId} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate text-foreground" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums font-medium text-foreground">
                {formatUsd(item.amount)}
              </span>
            </li>
          ))}
        </ul>
        <OrgFailure reason={failure} />
      </form>
    </Dialog>
  );
}

/** 周期发放：给勾选的成员统一发同一份周期配额（立即生效或指定时间生效） */
export function OrgGrantDialog({
  userIds,
  onClose,
  onDone,
}: {
  userIds: readonly number[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const [draft, setDraft] = useState<PeriodicDraft>(EMPTY_PERIODIC);
  const [error, setError] = useState<PeriodicError | null>(null);
  const [failure, setFailure] = useState<OrgErrorReason | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quota = parsePeriodic(draft);
    if (typeof quota === 'string') {
      setError(quota);
      return;
    }
    if (saving) return;
    setSaving(true);
    setFailure(null);
    const result = await batchMembers({ kind: 'quota', userIds: [...userIds], quota });
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
      id="org-grant"
      open
      initialFocus="org-grant-amount"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('grant.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="org-grant-form" loading={saving} data-org-grant-submit>
            {tc('actions.confirm')}
          </Button>
        </>
      }
    >
      <form
        id="org-grant-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
      >
        <OrgPeriodicFields
          idPrefix="org-grant"
          draft={draft}
          error={error}
          withStart
          onChange={(patch) => {
            setDraft((current) => ({ ...current, ...patch }));
            setError(null);
          }}
        />
        <OrgFailure reason={failure} />
      </form>
    </Dialog>
  );
}
