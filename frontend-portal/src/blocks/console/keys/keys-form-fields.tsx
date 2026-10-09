'use client';

import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Button } from '@/components/console/button';
import { GroupWithRate } from '@/components/console/group-rate';
import { Select, type SelectOption } from '@/components/console/select';
import { Switch } from '@/components/console/switch';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Textarea } from '@/components/ui/textarea';
import { formatUsd } from '@/lib/console';
import {
  AMOUNT_MAX,
  CUSTOM_KEY_MAX,
  CUSTOM_KEY_MIN,
  EXPIRY_MAX_DAYS,
  IP_LIST_MAX,
} from '@/lib/console/live/keys-rules';
import type { KeyGroupOption, KeyWindows } from '@/lib/console/live/keys-types';
import { addDays } from '@/lib/console/time';

import { KeyGroupOptionContent } from './keys-group-option';
import { EXPIRY_PRESETS, expiryPresetOf, type KeyFormErrors, type KeyFormMode } from './keys-model';

/**
 * 创建与编辑弹窗的表单项，照 sub2api 的密钥表单：名称、分组、自定义密钥（只在创建时有）、IP 限制、
 * 额度、限速、有效期。带开关的几项（自定义密钥、IP 限制、限速、有效期）打开后才显示下面的输入。
 * 出错时错误文字挂在控件的 aria-describedby 上，由 Field 带 role="alert" 播报。
 */

type Errors = KeyFormErrors;

/** 各项错误代码 → 一句话 */
function useErrorText() {
  const t = useTranslations('consoleKeys');
  return {
    name: (code: Errors['name']) =>
      code === 'required' ? t('errors.nameRequired') : code ? t('errors.nameTooLong') : null,
    group: (code: Errors['group']) => (code ? t('errors.groupRequired') : null),
    customKey: (code: Errors['customKey']) => {
      switch (code) {
        case 'required':
          return t('errors.customKeyRequired');
        case 'tooShort':
          return t('errors.customKeyTooShort', { min: CUSTOM_KEY_MIN });
        case 'tooLong':
          return t('errors.customKeyTooLong', { max: CUSTOM_KEY_MAX });
        case 'invalidChars':
          return t('errors.customKeyInvalidChars');
        default:
          return null;
      }
    },
    ip: (code: Errors['ipWhitelist']) =>
      code ? t('errors.ipInvalid', { max: IP_LIST_MAX }) : null,
    amount: (code: Errors['quota']) =>
      code ? t('errors.amountInvalid', { max: AMOUNT_MAX }) : null,
    expiry: (code: Errors['expiryDate'], mode: KeyFormMode) => {
      switch (code) {
        case 'invalid':
          return t('errors.expiryInvalid');
        case 'past':
          return mode === 'create' ? t('errors.expiryPastCreate') : t('errors.expiryPastEdit');
        case 'tooFar':
          return t('errors.expiryTooFar');
        default:
          return null;
      }
    },
  };
}

const describedBy = (id: string, message: string | null) =>
  message ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {};

export function KeyNameField({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: Errors['name'];
  onChange: (value: string) => void;
}) {
  const t = useTranslations('consoleKeys');
  const message = useErrorText().name(error);
  return (
    <Field label={t('form.name')} htmlFor="key-name" error={message}>
      <Input
        id="key-name"
        name="name"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...describedBy('key-name', message)}
      />
    </Field>
  );
}

/** 没选分组时下拉里的占位值（真实的分组 ID 不会是它） */
const NO_GROUP = 'none';

/**
 * 分组下拉：菜单里每项照原版 sub2api 写分组名、描述、倍率与高峰加价（见 KeyGroupOptionContent），
 * 选好后框里只写分组名 + 倍率；现在的分组不在可选列表里时（比如后台收回了），也照样列出来。
 */
export function KeyGroupField({
  value,
  groups,
  current,
  unavailable,
  error,
  onChange,
}: {
  value: number | null;
  groups: readonly KeyGroupOption[];
  /** 编辑时密钥现在的分组 */
  current?: { id: number; name: string; rate: number } | null;
  /** 分组读不到 */
  unavailable: boolean;
  error?: Errors['group'];
  onChange: (value: number | null) => void;
}) {
  const t = useTranslations('consoleKeys');
  const message =
    useErrorText().group(error) ?? (unavailable ? t('errors.groupsUnavailable') : null);
  const listed: KeyGroupOption[] = [...groups];
  if (current && !groups.some((group) => group.id === current.id)) {
    listed.push({ ...current, description: '', baseRate: current.rate, peak: null });
  }
  const options: SelectOption<string>[] = [
    ...(value === null ? [{ value: NO_GROUP, label: t('form.groupPlaceholder') }] : []),
    ...listed.map((group) => ({
      value: String(group.id),
      label: <KeyGroupOptionContent group={group} />,
      display: <GroupWithRate name={group.name} rate={group.rate} />,
    })),
  ];
  return (
    <Field label={t('form.group')} htmlFor="key-group" error={message}>
      <Select
        name="key-group"
        value={value === null ? NO_GROUP : String(value)}
        onChange={(next) => onChange(next === NO_GROUP ? null : Number(next))}
        options={options}
        ariaLabel={t('form.group')}
        menuClassName="w-[var(--radix-dropdown-menu-trigger-width)] max-w-[calc(100vw-2rem)] max-h-[min(24rem,60dvh)]"
      />
    </Field>
  );
}

/** 带开关的一项：标签行右边是开关，打开后显示下面的内容 */
function ToggleField({
  id,
  label,
  checked,
  onCheckedChange,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hint?: ReactNode;
  /** 下面只有一个输入框时，它的错误写在这里（id 是 `${id}-error`） */
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={checked ? hint : undefined}
      error={checked ? error : null}
      trailing={<Switch id={id} name={id} checked={checked} onCheckedChange={onCheckedChange} />}
    >
      {checked ? children : null}
    </Field>
  );
}

export function KeyCustomKeyField({
  enabled,
  value,
  error,
  onToggle,
  onChange,
}: {
  enabled: boolean;
  value: string;
  error?: Errors['customKey'];
  onToggle: (enabled: boolean) => void;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('consoleKeys');
  const message = useErrorText().customKey(error);
  return (
    <ToggleField
      id="key-custom-switch"
      label={t('form.customKey')}
      checked={enabled}
      onCheckedChange={onToggle}
      hint={t('form.customKeyHint')}
      error={message}
    >
      <Input
        id="key-custom"
        name="customKey"
        aria-label={t('form.customKey')}
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...describedBy('key-custom-switch', message)}
      />
    </ToggleField>
  );
}

export function KeyIpField({
  enabled,
  whitelist,
  blacklist,
  errors,
  onToggle,
  onChange,
}: {
  enabled: boolean;
  whitelist: string;
  blacklist: string;
  errors: Pick<Errors, 'ipWhitelist' | 'ipBlacklist'>;
  onToggle: (enabled: boolean) => void;
  onChange: (patch: { ipWhitelist?: string; ipBlacklist?: string }) => void;
}) {
  const t = useTranslations('consoleKeys');
  const text = useErrorText();
  const allowMessage = text.ip(errors.ipWhitelist);
  const blockMessage = text.ip(errors.ipBlacklist);
  return (
    <ToggleField
      id="key-ip-switch"
      label={t('form.ipLimit')}
      checked={enabled}
      onCheckedChange={onToggle}
      hint={t('form.ipHint')}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('form.ipWhitelist')} htmlFor="key-ip-allow" error={allowMessage}>
          <Textarea
            id="key-ip-allow"
            rows={3}
            spellCheck={false}
            className="font-mono text-xs"
            value={whitelist}
            onChange={(event) => onChange({ ipWhitelist: event.target.value })}
            {...describedBy('key-ip-allow', allowMessage)}
          />
        </Field>
        <Field label={t('form.ipBlacklist')} htmlFor="key-ip-block" error={blockMessage}>
          <Textarea
            id="key-ip-block"
            rows={3}
            spellCheck={false}
            className="font-mono text-xs"
            value={blacklist}
            onChange={(event) => onChange({ ipBlacklist: event.target.value })}
            {...describedBy('key-ip-block', blockMessage)}
          />
        </Field>
      </div>
    </ToggleField>
  );
}

/** 美元金额输入框：左边一个 $ */
function AmountInput({
  id,
  value,
  message,
  onChange,
}: {
  id: string;
  value: string;
  message: string | null;
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
        max={AMOUNT_MAX}
        step="0.01"
        placeholder="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-7"
        {...describedBy(id, message)}
      />
    </div>
  );
}

/** 编辑时显示的已用量 + 「重置」按钮 */
function UsedLine({
  text,
  resetLabel,
  onReset,
}: {
  text: string;
  resetLabel: string;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-xs">
      <span className="tabular-nums text-muted-foreground">{text}</span>
      <Button type="button" variant="ghost" size="sm" onClick={onReset}>
        <RotateCcw aria-hidden />
        {resetLabel}
      </Button>
    </div>
  );
}

export function KeyQuotaField({
  value,
  error,
  onChange,
  used,
  onReset,
}: {
  value: string;
  error?: Errors['quota'];
  onChange: (value: string) => void;
  /** 编辑时：已用与上限（有上限才给） */
  used?: { used: number; limit: number };
  onReset?: () => void;
}) {
  const t = useTranslations('consoleKeys');
  const message = useErrorText().amount(error);
  return (
    <Field label={t('form.quota')} htmlFor="key-quota" error={message} hint={t('form.quotaHint')}>
      <div className="space-y-2">
        <AmountInput id="key-quota" value={value} message={message} onChange={onChange} />
        {used && onReset ? (
          <UsedLine
            text={t('form.quotaUsed', { used: formatUsd(used.used), limit: formatUsd(used.limit) })}
            resetLabel={t('form.resetQuota')}
            onReset={onReset}
          />
        ) : null}
      </div>
    </Field>
  );
}

const WINDOWS = [
  { key: 'rate5h', id: 'key-rate-5h', label: 'form.rate5h', window: 'h5' },
  { key: 'rate1d', id: 'key-rate-1d', label: 'form.rate1d', window: 'd1' },
  { key: 'rate7d', id: 'key-rate-7d', label: 'form.rate7d', window: 'd7' },
] as const;

export function KeyRateLimitField({
  enabled,
  values,
  errors,
  onToggle,
  onChange,
  usage,
  onReset,
}: {
  enabled: boolean;
  values: { rate5h: string; rate1d: string; rate7d: string };
  errors: Pick<Errors, 'rate5h' | 'rate1d' | 'rate7d'>;
  onToggle: (enabled: boolean) => void;
  onChange: (patch: { rate5h?: string; rate1d?: string; rate7d?: string }) => void;
  /** 编辑时：三个窗口里已经花了多少（设了限速才给） */
  usage?: KeyWindows;
  onReset?: () => void;
}) {
  const t = useTranslations('consoleKeys');
  const text = useErrorText();
  return (
    <ToggleField
      id="key-rate-switch"
      label={t('form.rateLimit')}
      checked={enabled}
      onCheckedChange={onToggle}
      hint={t('form.rateLimitHint')}
    >
      <div className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-3">
          {WINDOWS.map((item) => {
            const message = text.amount(errors[item.key]);
            return (
              <Field key={item.key} label={t(item.label)} htmlFor={item.id} error={message}>
                <AmountInput
                  id={item.id}
                  value={values[item.key]}
                  message={message}
                  onChange={(value) => onChange({ [item.key]: value })}
                />
                {usage ? (
                  <p className="text-xs tabular-nums text-subtle-foreground">
                    {t('form.rateUsed', { used: formatUsd(usage[item.window]) })}
                  </p>
                ) : null}
              </Field>
            );
          })}
        </div>
        {usage && onReset ? (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw aria-hidden />
              {t('form.resetRateUsage')}
            </Button>
          </div>
        ) : null}
      </div>
    </ToggleField>
  );
}

/** 有效期：开关打开后，快捷选 7 / 30 / 90 天，或者自己挑到期日 */
export function KeyExpiryField({
  enabled,
  date,
  today,
  mode,
  error,
  onToggle,
  onChange,
}: {
  enabled: boolean;
  date: string;
  today: string;
  mode: KeyFormMode;
  error?: Errors['expiryDate'];
  onToggle: (enabled: boolean) => void;
  onChange: (date: string) => void;
}) {
  const t = useTranslations('consoleKeys');
  const message = useErrorText().expiry(error, mode);
  const preset = expiryPresetOf(today, date);
  return (
    <ToggleField
      id="key-expiry-switch"
      label={t('form.expiry')}
      checked={enabled}
      onCheckedChange={onToggle}
    >
      <div className="space-y-3">
        <SegmentedControl
          name="key-expiry-preset"
          value={String(preset)}
          onChange={(next) => {
            if (next !== 'custom') onChange(addDays(today, Number(next)));
          }}
          ariaLabel={t('form.expiry')}
          options={[
            ...EXPIRY_PRESETS.map((days) => ({
              value: String(days),
              label: t('form.expiryDays', { days }),
            })),
            { value: 'custom', label: t('form.expiryCustom') },
          ]}
        />
        <Field
          label={t('form.expiryDate')}
          htmlFor="key-expiry-date"
          error={message}
          hint={t('form.expiryDateHint')}
        >
          <Input
            id="key-expiry-date"
            type="date"
            min={mode === 'create' ? addDays(today, 1) : today}
            max={addDays(today, EXPIRY_MAX_DAYS)}
            value={date}
            onChange={(event) => onChange(event.target.value)}
            {...describedBy('key-expiry-date', message)}
          />
        </Field>
      </div>
    </ToggleField>
  );
}
