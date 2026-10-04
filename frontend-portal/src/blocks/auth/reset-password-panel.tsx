'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, useSyncExternalStore } from 'react';

import { AuthFormAlert } from '@/blocks/auth/auth-form-alert';
import { AuthPasswordInput } from '@/blocks/auth/auth-password-input';
import { Button } from '@/components/ui/button';
import { buttonClass } from '@/components/ui/button-styles';
import { Link } from '@/i18n/navigation';
import {
  newPasswordErrors,
  readResetLink,
  type NewPasswordErrors,
} from '@/lib/auth/password-reset';
import { resetPassword } from '@/lib/auth/password-reset-client';
import type { AuthErrorReason } from '@/lib/session/types';

import { AuthPanelFrame } from './auth-panel-frame';

/** 网址的查询参数只在浏览器里读：静态页面生成与首次水合时为 null */
const subscribe = () => () => {};
const clientSearch = () => window.location.search;
const serverSearch = (): string | null => null;

type Stage = 'form' | 'done' | 'invalid';

/**
 * 重置密码（邮件里的链接打开就是这一页，照 sub2api 原来的重置密码页）：链接带着邮箱和一次性凭证，
 * 填两遍新密码后提交；成功后去登录（其他设备上的登录会退出）。链接缺参数、无效或过期时提示重新申请。
 */
export function ResetPasswordPanel() {
  const t = useTranslations('auth');
  const search = useSyncExternalStore(subscribe, clientSearch, serverSearch);
  // undefined：还没读到网址；null：链接不完整
  const link = useMemo(() => (search === null ? undefined : readResetLink(search)), [search]);
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState<NewPasswordErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<Stage>('form');

  const messageFor = (reason: AuthErrorReason): string => {
    switch (reason) {
      case 'PASSWORD_RESET_DISABLED':
      case 'USER_NOT_ACTIVE':
      case 'TOO_MANY_REQUESTS':
      case 'BACKEND_UNAVAILABLE':
        return t(`reset.errors.${reason}`);
      default:
        return t('reset.errors.generic');
    }
  };

  const setValue = (key: 'password' | 'confirm', value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !link) return;
    const found = newPasswordErrors(values.password, values.confirm);
    if (found.password || found.confirm) {
      setErrors(found);
      document.getElementById(found.password ? 'new-password' : 'confirm-password')?.focus();
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result = await resetPassword(link.email, link.token, values.password);
    setSubmitting(false);
    if (result.ok) {
      setStage('done');
      return;
    }
    if (result.reason === 'INVALID_RESET_TOKEN') {
      setStage('invalid');
      return;
    }
    setFormError(messageFor(result.reason));
  };

  const invalid = link === null || stage === 'invalid';
  let title = t('reset.title');
  if (invalid) title = t('reset.invalidTitle');
  else if (stage === 'done') title = t('reset.doneTitle');

  let body: React.ReactNode = null;
  if (invalid) {
    body = (
      <div data-reset-invalid className="mt-4 space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">{t('reset.invalid')}</p>
        <Link href="/forgot-password" data-reset-again className={buttonClass({ block: true })}>
          {t('reset.again')}
        </Link>
      </div>
    );
  } else if (stage === 'done') {
    body = (
      <div data-reset-done className="mt-4 space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">{t('reset.done')}</p>
        <Link href="/login" data-reset-login className={buttonClass({ block: true })}>
          {t('reset.toLogin')}
        </Link>
      </div>
    );
  } else if (link) {
    body = (
      <>
        <p className="mt-3 break-all text-sm text-muted-foreground">
          {t('reset.for', { email: link.email })}
        </p>
        <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-5" data-reset-form>
          <AuthPasswordInput
            id="new-password"
            name="new-password"
            label={t('reset.password')}
            value={values.password}
            onChange={(value) => setValue('password', value)}
            error={errors.password ? t(`fields.errors.${errors.password}`) : null}
            hint={t('fields.passwordHint')}
            autoComplete="new-password"
            dataAttribute="data-reset-password"
          />
          <AuthPasswordInput
            id="confirm-password"
            name="confirm-password"
            label={t('reset.confirm')}
            value={values.confirm}
            onChange={(value) => setValue('confirm', value)}
            error={errors.confirm ? t(`reset.errors.${errors.confirm}`) : null}
            autoComplete="new-password"
            dataAttribute="data-reset-confirm"
          />
          <AuthFormAlert message={formError} />
          <Button type="submit" block loading={submitting} data-reset-submit>
            {t('reset.submit')}
          </Button>
        </form>
      </>
    );
  }

  return (
    <AuthPanelFrame id="reset-password">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {body}
      {stage === 'done' ? null : (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('forgot.remembered')}{' '}
          <Link href="/login" data-to-login className="font-medium text-foreground hover:underline">
            {t('forgot.toLogin')}
          </Link>
        </p>
      )}
    </AuthPanelFrame>
  );
}

export default ResetPasswordPanel;
