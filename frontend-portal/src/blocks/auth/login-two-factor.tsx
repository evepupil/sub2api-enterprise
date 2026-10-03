'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { AuthFormAlert } from '@/blocks/auth/auth-form-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { submitTwoFactorCode } from '@/lib/session/client';
import type { AuthErrorReason, SessionUser } from '@/lib/session/types';

const CODE_PATTERN = /^\d{6}$/;

/**
 * 登录第二步：账号开了两步验证时，输入身份验证器里的 6 位验证码。
 * 验证码错了可以重输；临时凭证过期（后端 5 分钟左右失效）就回到第一步，带上「验证已过期」提示。
 */
export function LoginTwoFactor({
  emailMasked,
  onSignedIn,
  onExpired,
}: {
  emailMasked: string;
  onSignedIn: (user: SessionUser) => void;
  /** 回到第一步；message 为要在第一步显示的提示，主动返回时为 null */
  onExpired: (message: string | null) => void;
}) {
  const t = useTranslations('auth.login.twoFactor');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const messageFor = (reason: AuthErrorReason): string => {
    switch (reason) {
      case 'TOTP_INVALID_CODE':
        return t('errors.invalid');
      case 'TOO_MANY_REQUESTS':
        return t('errors.tooMany');
      case 'BACKEND_UNAVAILABLE':
        return t('errors.unavailable');
      default:
        return t('errors.generic');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const value = code.trim();
    if (!CODE_PATTERN.test(value)) {
      setFieldError(t('errors.format'));
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result = await submitTwoFactorCode(value);
    if (result.kind === 'signed_in') {
      onSignedIn(result.user);
      return;
    }
    setSubmitting(false);
    if (result.kind === 'error' && result.reason === 'TWO_FACTOR_EXPIRED') {
      onExpired(t('errors.expired'));
      return;
    }
    if (result.kind === 'error') {
      setFormError(messageFor(result.reason));
      if (result.reason === 'TOTP_INVALID_CODE') {
        setCode('');
        inputRef.current?.focus();
      }
    }
  };

  return (
    <div data-login-two-factor>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('desc', { email: emailMasked })}</p>

      <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field label={t('code')} htmlFor="totp-code" error={fieldError}>
          <Input
            ref={inputRef}
            id="totp-code"
            name="totp-code"
            data-login-totp
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
              setFieldError(null);
            }}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'totp-code-error' : undefined}
            className="min-w-0 font-mono tracking-[0.3em]"
          />
        </Field>

        <AuthFormAlert message={formError} />

        <Button type="submit" block loading={submitting} data-login-totp-submit>
          {t('submit')}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => onExpired(null)}
        className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        data-login-totp-back
      >
        {t('back')}
      </button>
    </div>
  );
}

export default LoginTwoFactor;
