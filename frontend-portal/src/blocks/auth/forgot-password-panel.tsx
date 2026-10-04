'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { AuthFormAlert } from '@/blocks/auth/auth-form-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import { resetEmailError } from '@/lib/auth/password-reset';
import { requestPasswordReset } from '@/lib/auth/password-reset-client';
import { useAuthSettings } from '@/lib/auth/use-auth-settings';
import { useCountdown } from '@/lib/auth/use-countdown';
import type { AuthErrorReason } from '@/lib/session/types';

import { AuthPanelFrame } from './auth-panel-frame';

/** 发过一次后多久才能再发（秒）；后端每个 IP 每分钟最多 5 次 */
const RESEND_SECONDS = 60;

/**
 * 找回密码（照 sub2api 原来的找回密码页）：填邮箱 → 发重置链接，邮件语言跟着页面语言。
 * 发出后不管邮箱有没有注册都显示同一句话（后端也不透露），60 秒后可以重发。
 * 后台没开找回密码时只显示一句「暂时关闭」。
 */
export function ForgotPasswordPanel() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const { loaded, settings } = useAuthSettings();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const countdown = useCountdown();

  const messageFor = (reason: AuthErrorReason): string => {
    switch (reason) {
      case 'PASSWORD_RESET_DISABLED':
      case 'CAPTCHA_REQUIRED':
      case 'TOO_MANY_REQUESTS':
      case 'BACKEND_UNAVAILABLE':
        return t(`forgot.errors.${reason}`);
      default:
        return t('forgot.errors.generic');
    }
  };

  const send = async (address: string) => {
    setSubmitting(true);
    setFormError(null);
    const result = await requestPasswordReset(address, locale);
    setSubmitting(false);
    if (!result.ok) {
      setFormError(messageFor(result.reason));
      return;
    }
    setSentTo(address);
    countdown.start(RESEND_SECONDS);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !loaded) return;
    const problem = resetEmailError(email);
    if (problem) {
      setFieldError(t(`fields.errors.${problem}`));
      document.getElementById('email')?.focus();
      return;
    }
    void send(email.trim());
  };

  const closed = loaded && !settings.passwordResetEnabled;

  let body: React.ReactNode;
  if (closed) {
    body = (
      <p
        data-forgot-closed
        className="mt-8 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground"
      >
        {t('forgot.closed')}
      </p>
    );
  } else if (sentTo !== null) {
    body = (
      <div data-forgot-sent className="mt-4 space-y-5">
        <p className="break-words text-sm leading-6 text-muted-foreground">
          {t('forgot.sent', { email: sentTo })}
        </p>
        <AuthFormAlert message={formError} />
        <Button
          variant="secondary"
          block
          loading={submitting}
          disabled={countdown.seconds > 0}
          onClick={() => void send(sentTo)}
          data-forgot-resend
        >
          {countdown.seconds > 0
            ? t('forgot.resendIn', { seconds: countdown.seconds })
            : t('forgot.resend')}
        </Button>
      </div>
    );
  } else {
    body = (
      <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-5" data-forgot-form>
        <Field label={t('fields.email')} htmlFor="email" error={fieldError}>
          <Input
            id="email"
            name="email"
            type="email"
            data-forgot-email
            autoComplete="email"
            placeholder="name@company.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldError(null);
              setFormError(null);
            }}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'email-error' : undefined}
            className="min-w-0"
          />
        </Field>
        <AuthFormAlert message={formError} />
        <Button type="submit" block loading={submitting} disabled={!loaded} data-forgot-submit>
          {t('forgot.submit')}
        </Button>
      </form>
    );
  }

  return (
    <AuthPanelFrame id="forgot-password">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {sentTo !== null && !closed ? t('forgot.sentTitle') : t('forgot.title')}
      </h1>
      {body}
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t('forgot.remembered')}{' '}
        <Link href="/login" data-to-login className="font-medium text-foreground hover:underline">
          {t('forgot.toLogin')}
        </Link>
      </p>
    </AuthPanelFrame>
  );
}

export default ForgotPasswordPanel;
