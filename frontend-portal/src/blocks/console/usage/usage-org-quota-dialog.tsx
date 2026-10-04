'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { OrgFailure } from '@/blocks/console/organization/organization-member-dialogs';
import { OrgAmountInput } from '@/blocks/console/organization/organization-periodic-fields';
import { Button } from '@/components/console/button';
import { Dialog } from '@/components/console/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { formatUsd } from '@/lib/console';
import { submitQuotaRequest } from '@/lib/console/live/org-client';
import { NOTE_MAX, noteTooLong, requestAmountError } from '@/lib/console/live/org-rules';
import type { MyOrgQuota, OrgErrorReason } from '@/lib/console/live/org-types';

/**
 * 组织成员申请额度：金额（管理员设了单次最低、最高时写在下面）与理由（可选，最多 500 个字）。
 * 「申请了就加」的组织提交后额度当场增加；「先审批再加」的等管理员处理。
 */
export function UsageOrgQuotaDialog({
  quota,
  onClose,
  onDone,
}: {
  quota: MyOrgQuota;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('consoleOrg');
  const tc = useTranslations('console');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<'amount' | 'range' | null>(null);
  const [failure, setFailure] = useState<OrgErrorReason | null>(null);
  const [saving, setSaving] = useState(false);
  const tooLong = noteTooLong(reason);
  const { minAmount: min, maxAmount: max } = quota;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = requestAmountError(amount, min, max);
    setError(problem);
    if (problem || tooLong || saving) return;
    setSaving(true);
    setFailure(null);
    const result = await submitQuotaRequest(Number(amount.trim()), reason.trim());
    setSaving(false);
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }
    onDone();
    onClose();
  };

  // 有范围时把范围写在下面；超出范围的报错也直接写范围，免得报错把范围盖掉
  const range =
    min !== null && max !== null
      ? t('myQuota.range', { min: formatUsd(min), max: formatUsd(max) })
      : undefined;
  let amountError: string | null = null;
  if (error === 'amount') amountError = t('errors.requestAmount');
  else if (error === 'range') amountError = range ?? t('errors.action.request_amount');

  return (
    <Dialog
      id="org-apply"
      open
      size="sm"
      initialFocus="org-apply-amount"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('myQuota.dialogTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="org-apply-form" loading={saving} data-org-apply-submit>
            {t('myQuota.submit')}
          </Button>
        </>
      }
    >
      <form
        id="org-apply-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="space-y-4"
      >
        <Field
          label={t('myQuota.amount')}
          htmlFor="org-apply-amount"
          hint={range}
          error={amountError}
        >
          <OrgAmountInput
            id="org-apply-amount"
            value={amount}
            invalid={error !== null}
            onChange={(value) => {
              setAmount(value);
              setError(null);
            }}
          />
        </Field>
        <Field
          label={t('myQuota.reason')}
          htmlFor="org-apply-reason"
          error={tooLong ? t('errors.noteTooLong') : null}
        >
          <Textarea
            id="org-apply-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            footer={`${Array.from(reason.trim()).length} / ${NOTE_MAX}`}
          />
        </Field>
        <OrgFailure reason={failure} />
      </form>
    </Dialog>
  );
}
