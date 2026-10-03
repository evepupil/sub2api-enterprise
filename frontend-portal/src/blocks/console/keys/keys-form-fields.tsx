'use client';

import { useTranslations } from 'next-intl';

import { Select, type SelectOption } from '@/components/console/select';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';

import {
  NAME_MAX_LENGTH,
  QUOTA_MAX,
  QUOTA_MIN,
  type ExpiryOption,
  type KeyFormErrors,
  type QuotaMode,
} from './keys-model';

/**
 * 创建与编辑弹窗共用的三个表单项。控件的 id 固定（key-name、key-quota），
 * 出错时错误文字挂在控件的 aria-describedby 上，由 Field 带 role="alert" 播报。
 */

export function KeyNameField({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: KeyFormErrors['name'];
  onChange: (value: string) => void;
}) {
  const t = useTranslations('consoleKeys');
  const message =
    error === 'required'
      ? t('errors.nameRequired')
      : error === 'tooLong'
        ? t('errors.nameTooLong', { max: NAME_MAX_LENGTH })
        : null;
  return (
    <Field label={t('form.name')} htmlFor="key-name" error={message}>
      <Input
        id="key-name"
        name="name"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? 'key-name-error' : undefined}
      />
    </Field>
  );
}

export function KeyQuotaField({
  mode,
  amount,
  error,
  onModeChange,
  onAmountChange,
}: {
  mode: QuotaMode;
  amount: string;
  error?: KeyFormErrors['quota'];
  onModeChange: (mode: QuotaMode) => void;
  onAmountChange: (amount: string) => void;
}) {
  const t = useTranslations('consoleKeys');
  const message = error ? t('errors.quotaRange', { min: QUOTA_MIN, max: QUOTA_MAX }) : null;
  return (
    <Field label={t('form.quota')} htmlFor="key-quota" error={message}>
      <div className="space-y-3">
        <SegmentedControl
          name="key-quota-mode"
          value={mode}
          onChange={onModeChange}
          ariaLabel={t('form.quota')}
          options={[
            { value: 'unlimited', label: t('form.quotaUnlimited') },
            { value: 'custom', label: t('form.quotaCustom') },
          ]}
        />
        {mode === 'custom' ? (
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle-foreground"
            >
              $
            </span>
            <Input
              id="key-quota"
              name="quota"
              type="number"
              inputMode="decimal"
              min={QUOTA_MIN}
              max={QUOTA_MAX}
              step={1}
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              aria-invalid={message ? true : undefined}
              aria-describedby={message ? 'key-quota-error' : undefined}
              className="pl-7"
            />
          </div>
        ) : null}
      </div>
    </Field>
  );
}

/**
 * 有效期下拉：永久、30 天、90 天、1 年；传入 keepDate 时多一项「保持原日期」（编辑已有到期日的密钥）。
 */
export function KeyExpiryField({
  value,
  keepDate = null,
  onChange,
}: {
  value: ExpiryOption;
  keepDate?: string | null;
  onChange: (value: ExpiryOption) => void;
}) {
  const t = useTranslations('consoleKeys');
  const options: SelectOption<ExpiryOption>[] = [
    { value: 'never', label: t('form.expiryNever') },
    ...(keepDate === null
      ? []
      : [{ value: 'keep' as const, label: t('form.expiryKeep', { date: keepDate }) }]),
    { value: '30d', label: t('form.expiry30d') },
    { value: '90d', label: t('form.expiry90d') },
    { value: '1y', label: t('form.expiry1y') },
  ];
  return (
    <Field label={t('form.expiry')} htmlFor="key-expiry">
      <Select
        name="key-expiry"
        value={value}
        onChange={onChange}
        options={options}
        ariaLabel={t('form.expiry')}
      />
    </Field>
  );
}
