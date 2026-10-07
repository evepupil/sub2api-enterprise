'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { Panel } from '@/components/console/panel';
import { Avatar } from '@/components/console/shell/user-menu';
import { Button } from '@/components/console/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { saveUsername } from '@/lib/console/live/account-client';
import type { AccountErrorReason } from '@/lib/console/live/account-types';
import { useSession } from '@/lib/session/session-provider';

import { PROFILE_NAME_MAX, RESULT_FLASH_MS } from './settings-config';
import { SettingsFlash } from './settings-flash';
import { useFlash } from './settings-timers';
import { validateProfileName, type ProfileNameError } from './settings-validation';

const NAME_FIELD_ID = 'profile-name';

/**
 * 个人资料：头像、可改的名称（后台的用户名）、只读的登录邮箱，都取当前登录的账号。
 * 名称没有改动时「保存」不可点；保存成功后头像菜单里的名字跟着变，按钮旁边显示 2 秒「已保存」。
 */
export function SettingsProfilePanel() {
  const t = useTranslations('consoleSettings');
  const tc = useTranslations('console');
  const { user, updateUser } = useSession();
  const saved = useFlash(RESULT_FLASH_MS);

  // 没动过输入框时 draft 为 null，显示账号当前的用户名；登录信息还没读到时为空
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<ProfileNameError | null>(null);
  const [failure, setFailure] = useState<AccountErrorReason | null>(null);
  const [saving, setSaving] = useState(false);

  const current = user?.username ?? '';
  const name = draft ?? current;
  const dirty = user !== null && name.trim() !== current;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !dirty) return;
    const found = validateProfileName(name);
    if (found) {
      setError(found);
      document.getElementById(NAME_FIELD_ID)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    const result = await saveUsername(name.trim());
    setSaving(false);
    if (!result.ok) {
      setFailure(result.reason);
      return;
    }
    updateUser({ username: result.data });
    setDraft(null);
    saved.show();
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
                readOnly={saving || user === null}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError(null);
                  setFailure(null);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${NAME_FIELD_ID}-error` : undefined}
              />
            </Field>
            <Field label={t('profile.email')} htmlFor="profile-email">
              <Input id="profile-email" type="email" value={user?.email ?? ''} readOnly disabled />
            </Field>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end">
          {failure ? (
            <p
              role="alert"
              data-profile-error={failure}
              className="mr-auto pr-3 text-sm text-danger"
            >
              {t(`errors.${failure}`)}
            </p>
          ) : null}
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
