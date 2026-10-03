'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { AuthFormAlert } from '@/blocks/auth/auth-form-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { sendVerifyCode } from '@/lib/auth/register-client';
import type { AuthErrorReason } from '@/lib/session/types';

const CODE_PATTERN = /^\d{6}$/;

/**
 * 注册第二步（后台开了邮箱验证时）：进来就给邮箱发验证码，倒计时结束后可重发；
 * 输入 6 位验证码后由 onSubmit 带着验证码真正注册。验证码错了清空重输，其他失败显示原因。
 */
export function RegisterVerifyStep({
  email,
  submitLabel,
  reasonMessage,
  onSubmit,
  onBack,
}: {
  email: string;
  submitLabel: string;
  reasonMessage: (reason: AuthErrorReason) => string;
  /** 带验证码注册；成功时由调用方跳走，失败返回原因 */
  onSubmit: (code: string) => Promise<AuthErrorReason | null>;
  onBack: () => void;
}) {
  const t = useTranslations('auth');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentOnce = useRef(false);

  // 倒计时每秒减一，到 0 停
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => Math.max(value - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const send = useCallback(async () => {
    setSending(true);
    setFormError(null);
    const result = await sendVerifyCode(email);
    setSending(false);
    if (result.ok) {
      setSent(true);
      setCountdown(result.countdown);
      inputRef.current?.focus();
    } else {
      setFormError(reasonMessage(result.reason));
    }
  }, [email, reasonMessage]);

  // 进入这一步就发一次（开发模式下组件会挂载两次，只发一次）
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    void send();
  }, [send]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const value = code.trim();
    if (!CODE_PATTERN.test(value)) {
      setFieldError(t('fields.errors.codeFormat'));
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const reason = await onSubmit(value);
    if (reason === null) return;
    setSubmitting(false);
    setFormError(reasonMessage(reason));
    if (reason === 'INVALID_VERIFY_CODE') {
      setCode('');
      inputRef.current?.focus();
    }
  };

  return (
    <div data-register-verify>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {t('register.verify.title')}
      </h1>
      <p className="mt-2 break-all text-sm text-muted-foreground">
        {sent ? t('register.verify.desc', { email }) : t('register.verify.sending', { email })}
      </p>

      <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field label={t('register.verify.code')} htmlFor="verify-code" error={fieldError}>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              id="verify-code"
              name="verify-code"
              data-register-code
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
              aria-describedby={fieldError ? 'verify-code-error' : undefined}
              className="min-w-0 flex-1 font-mono tracking-[0.3em]"
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={sending || countdown > 0}
              loading={sending}
              onClick={() => void send()}
              data-register-resend
            >
              {countdown > 0
                ? t('register.verify.resendIn', { seconds: countdown })
                : t('register.verify.resend')}
            </Button>
          </div>
        </Field>

        <AuthFormAlert message={formError} />

        <Button type="submit" block loading={submitting} data-register-verify-submit>
          {submitLabel}
        </Button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        data-register-verify-back
      >
        {t('register.verify.back')}
      </button>
    </div>
  );
}

export default RegisterVerifyStep;
