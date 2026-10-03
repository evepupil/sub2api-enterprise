'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Panel } from '@/components/console/panel';
import { Button } from '@/components/console/button';

import { CHANGE_PASSWORD_MS, PASSWORD_MIN_LENGTH, RESULT_FLASH_MS } from './settings-config';
import { SettingsFlash } from './settings-flash';
import { SettingsPasswordField } from './settings-password-field';
import { useFlash, useSchedule } from './settings-timers';
import {
  validatePasswordForm,
  type PasswordErrors,
  type PasswordField,
  type PasswordValues,
} from './settings-validation';

/** 三个密码框，从上到下：当前、新、确认。校验失败时焦点落在第一个出错的框上 */
const FIELDS = [
  {
    key: 'current',
    id: 'password-current',
    label: 'password.current',
    autoComplete: 'current-password',
  },
  { key: 'next', id: 'password-new', label: 'password.new', autoComplete: 'new-password' },
  {
    key: 'confirm',
    id: 'password-confirm',
    label: 'password.confirm',
    autoComplete: 'new-password',
  },
] as const;

const EMPTY_VALUES: PasswordValues = { current: '', next: '', confirm: '' };

/**
 * 登录密码：当前密码、新密码、确认新密码。
 * 所有出错的框同时标红；通过后转 1 秒圈，清空三个框，按钮旁边短暂显示「密码已修改」。
 */
export function SettingsPasswordPanel() {
  const t = useTranslations('consoleSettings');
  const schedule = useSchedule();
  const done = useFlash(RESULT_FLASH_MS);
  const [values, setValues] = useState<PasswordValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [saving, setSaving] = useState(false);

  /** 输入即清掉该框的错误，其他框的错误保持不变 */
  const setValue = (key: PasswordField, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const found = validatePasswordForm(values);
    const first = FIELDS.find((field) => found[field.key]);
    if (first) {
      setErrors(found);
      document.getElementById(first.id)?.focus();
      return;
    }
    setErrors({});
    setSaving(true);
    schedule(() => {
      setValues(EMPTY_VALUES);
      setSaving(false);
      done.show();
    }, CHANGE_PASSWORD_MS);
  };

  const errorText = (key: PasswordField): string | null => {
    const code = errors[key];
    return code ? t(`password.errors.${code}`, { min: PASSWORD_MIN_LENGTH }) : null;
  };

  return (
    <Panel id="password" title={t('password.title')}>
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        {FIELDS.map((field) => (
          <SettingsPasswordField
            key={field.key}
            id={field.id}
            label={t(field.label)}
            value={values[field.key]}
            onChange={(value) => setValue(field.key, value)}
            error={errorText(field.key)}
            autoComplete={field.autoComplete}
            readOnly={saving}
          />
        ))}
        <div className="flex items-center justify-end pt-1">
          <SettingsFlash visible={done.visible}>{t('password.saved')}</SettingsFlash>
          <Button type="submit" data-password-save loading={saving}>
            {t('password.save')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
