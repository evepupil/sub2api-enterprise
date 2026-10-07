'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Panel } from '@/components/console/panel';
import { Button } from '@/components/console/button';
import { changePassword } from '@/lib/console/live/account-client';
import type { AccountErrorReason } from '@/lib/console/live/account-types';
import { loginRedirectFor } from '@/lib/session/guard';

import { PASSWORD_MIN_LENGTH, RELOGIN_DELAY_MS } from './settings-config';
import { SettingsFlash } from './settings-flash';
import { SettingsPasswordField } from './settings-password-field';
import { useSchedule } from './settings-timers';
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
 * 登录密码：当前密码、新密码、确认新密码，提交给后台修改。
 * 所有出错的框同时标红；当前密码不对时标在「当前密码」框上。改好后后台会让旧的登录全部失效，
 * 所以清空三个框、显示「密码已修改，请用新密码重新登录」，过一会儿跳到登录页（登录后回到本页）。
 */
export function SettingsPasswordPanel() {
  const t = useTranslations('consoleSettings');
  const schedule = useSchedule();
  const [values, setValues] = useState<PasswordValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [failure, setFailure] = useState<AccountErrorReason | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  /** 输入即清掉该框的错误，其他框的错误保持不变 */
  const setValue = (key: PasswordField, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFailure(null);
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || done) return;
    const found = validatePasswordForm(values);
    const first = FIELDS.find((field) => found[field.key]);
    if (first) {
      setErrors(found);
      document.getElementById(first.id)?.focus();
      return;
    }
    setErrors({});
    setFailure(null);
    setSaving(true);
    const result = await changePassword(values.current, values.next);
    setSaving(false);
    if (!result.ok) {
      if (result.reason === 'password_incorrect') {
        setErrors({ current: 'currentWrong' });
        document.getElementById('password-current')?.focus();
      } else {
        setFailure(result.reason);
      }
      return;
    }
    setValues(EMPTY_VALUES);
    setDone(true);
    schedule(() => {
      const { pathname, search } = window.location;
      window.location.replace(loginRedirectFor(pathname, search));
    }, RELOGIN_DELAY_MS);
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
            readOnly={saving || done}
          />
        ))}
        <div className="flex items-center justify-end pt-1">
          {failure ? (
            <p
              role="alert"
              data-password-error={failure}
              className="mr-auto pr-3 text-sm text-danger"
            >
              {t(`errors.${failure}`)}
            </p>
          ) : null}
          <SettingsFlash visible={done}>{t('password.saved')}</SettingsFlash>
          <Button type="submit" data-password-save loading={saving} disabled={done}>
            {t('password.save')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
