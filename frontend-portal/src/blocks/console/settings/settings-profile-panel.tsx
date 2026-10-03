'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Panel } from '@/components/console/panel';
import { Avatar } from '@/components/console/shell/user-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/console/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { AppLocale } from '@/i18n/routing';
import { CURRENT_USER } from '@/lib/console';

import { PROFILE_NAME_MAX, RESULT_FLASH_MS, SAVE_PROFILE_MS } from './settings-config';
import { SettingsFlash } from './settings-flash';
import { useFlash, useSchedule } from './settings-timers';
import { validateProfileName, type ProfileNameError } from './settings-validation';

const NAME_FIELD_ID = 'profile-name';

/**
 * 个人资料：头像、可改的名称、只读的邮箱（已验证）。
 * 名称没有改动时「保存」不可点；保存先转 0.8 秒圈，成功后按钮旁边显示 2 秒「已保存」。
 */
export function SettingsProfilePanel() {
  const t = useTranslations('consoleSettings');
  const tc = useTranslations('console');
  const locale = useLocale() as AppLocale;
  const schedule = useSchedule();
  const saved = useFlash(RESULT_FLASH_MS);

  // 已保存的名称用来判断「有没有改动」；输入框里的名称是正在编辑的草稿
  const [savedName, setSavedName] = useState(() => CURRENT_USER.name[locale]);
  const [name, setName] = useState(() => CURRENT_USER.name[locale]);
  const [error, setError] = useState<ProfileNameError | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = name.trim() !== savedName;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !dirty) return;
    const found = validateProfileName(name);
    if (found) {
      setError(found);
      document.getElementById(NAME_FIELD_ID)?.focus();
      return;
    }
    const next = name.trim();
    setSaving(true);
    schedule(() => {
      setSavedName(next);
      setName(next);
      setSaving(false);
      saved.show();
    }, SAVE_PROFILE_MS);
  };

  return (
    <Panel id="profile" title={t('profile.title')}>
      <form noValidate onSubmit={handleSubmit}>
        <div className="flex flex-col gap-5 sm:flex-row">
          <Avatar className="size-14 text-base" />
          <div className="min-w-0 flex-1 space-y-4">
            <Field
              label={t('profile.name')}
              htmlFor={NAME_FIELD_ID}
              error={error ? t(`profile.errors.${error}`, { max: PROFILE_NAME_MAX }) : null}
            >
              <Input
                id={NAME_FIELD_ID}
                name="name"
                autoComplete="name"
                value={name}
                readOnly={saving}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${NAME_FIELD_ID}-error` : undefined}
              />
            </Field>
            <Field label={t('profile.email')} htmlFor="profile-email">
              <div className="flex items-center gap-2">
                <Input
                  id="profile-email"
                  type="email"
                  value={CURRENT_USER.email}
                  readOnly
                  disabled
                  className="min-w-0 flex-1"
                />
                <Badge tone="success" className="self-center">
                  {t('profile.verified')}
                </Badge>
              </div>
            </Field>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end">
          {/* 刚保存完又开始改动时，「已保存」立刻消失，避免和新的未保存改动矛盾 */}
          <SettingsFlash visible={saved.visible && !dirty}>{t('profile.saved')}</SettingsFlash>
          <Button type="submit" data-profile-save disabled={!dirty} loading={saving}>
            {tc('actions.save')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
