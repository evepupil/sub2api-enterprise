'use client';

import { useTranslations } from 'next-intl';

import { Switch } from '@/components/console/switch';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PERIOD_DAYS_MAX } from '@/lib/console/live/org-rules';

import type { PeriodicDraft, PeriodicError } from './organization-model';

/** 美元金额输入框：左边一个 $ */
export function OrgAmountInput({
  id,
  value,
  invalid,
  onChange,
}: {
  id: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle-foreground"
      >
        $
      </span>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="pl-7"
      />
    </div>
  );
}

/**
 * 周期配额的几项：每期金额、周期天数；withStart 时再加「立即生效」开关，关掉后选生效时间（北京时间）。
 * 设置单个成员的配额、勾选后周期发放共用；新成员默认配额不要生效时间（从加入时刻算起）。
 */
export function OrgPeriodicFields({
  idPrefix,
  draft,
  error,
  withStart,
  onChange,
}: {
  idPrefix: string;
  draft: PeriodicDraft;
  error: PeriodicError | null;
  withStart: boolean;
  onChange: (patch: Partial<PeriodicDraft>) => void;
}) {
  const t = useTranslations('consoleOrg');
  const amountId = `${idPrefix}-amount`;
  const periodId = `${idPrefix}-period`;
  const startId = `${idPrefix}-start`;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('quota.perPeriod')}
          htmlFor={amountId}
          error={error === 'amount' ? t('errors.amount') : null}
        >
          <OrgAmountInput
            id={amountId}
            value={draft.amount}
            invalid={error === 'amount'}
            onChange={(amount) => onChange({ amount })}
          />
        </Field>
        <Field
          label={t('quota.periodDays')}
          htmlFor={periodId}
          error={error === 'period' ? t('errors.period') : null}
        >
          <Input
            id={periodId}
            type="number"
            inputMode="numeric"
            min={1}
            max={PERIOD_DAYS_MAX}
            step={1}
            value={draft.periodDays}
            onChange={(event) => onChange({ periodDays: event.target.value })}
            aria-invalid={error === 'period' ? true : undefined}
            aria-describedby={error === 'period' ? `${periodId}-error` : undefined}
          />
        </Field>
      </div>
      {withStart ? (
        <Field
          label={t('quota.immediate')}
          htmlFor={`${idPrefix}-immediate`}
          trailing={
            <Switch
              id={`${idPrefix}-immediate`}
              name={`${idPrefix}-immediate`}
              checked={draft.immediate}
              onCheckedChange={(immediate) => onChange({ immediate })}
            />
          }
        >
          {draft.immediate ? null : (
            <Field
              label={t('quota.startAt')}
              htmlFor={startId}
              hint={t('quota.startAtHint')}
              error={error === 'start' ? t('errors.start') : null}
            >
              <Input
                id={startId}
                type="datetime-local"
                value={draft.startAt}
                onChange={(event) => onChange({ startAt: event.target.value })}
                aria-invalid={error === 'start' ? true : undefined}
                aria-describedby={error === 'start' ? `${startId}-error` : undefined}
              />
            </Field>
          )}
        </Field>
      ) : null}
    </div>
  );
}
