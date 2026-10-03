'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { AuthFormAlert } from '@/blocks/auth/auth-form-alert';
import { AuthPasswordInput } from '@/blocks/auth/auth-password-input';
import { LoginTwoFactor } from '@/blocks/auth/login-two-factor';
import { Brand } from '@/components/layout/brand';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Link, useRouter } from '@/i18n/navigation';
import { signIn } from '@/lib/session/client';
import { safeNextPath } from '@/lib/session/guard';
import type { AuthErrorReason } from '@/lib/session/types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginErrors = Partial<Record<'email' | 'password', string>>;

type Step = { kind: 'credentials' } | { kind: 'two_factor'; emailMasked: string };

/**
 * 登录表单：个人与组织成员都用邮箱和密码登录，界面不区分账号类型。
 * 提交经官网服务器转给后端；成功后进控制台（有回跳地址就回到原来要去的页）。
 * 账号开了两步验证时切到第二步输入验证码。找回密码和谷歌登录还没接后端，入口先不显示。
 */
export function LoginPanel() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = (key: 'email' | 'password', value: string) => {
    // 输入即清掉该字段的错误和整表提示
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  /** 只查必填和邮箱格式；密码长短由后端判断（老账号可能是 6 位密码） */
  const validate = (): LoginErrors => {
    const next: LoginErrors = {};
    if (values.email.trim() === '') {
      next.email = t('fields.errors.emailRequired');
    } else if (!EMAIL_PATTERN.test(values.email.trim())) {
      next.email = t('fields.errors.emailInvalid');
    }
    if (values.password === '') {
      next.password = t('fields.errors.passwordRequired');
    }
    return next;
  };

  const messageFor = (reason: AuthErrorReason): string => {
    switch (reason) {
      case 'INVALID_CREDENTIALS':
      case 'USER_NOT_ACTIVE':
      case 'ORGANIZATION_DISABLED':
      case 'TOO_MANY_REQUESTS':
      case 'BACKEND_UNAVAILABLE':
        return t(`login.errors.${reason}`);
      default:
        return t('login.errors.generic');
    }
  };

  /** 登录成功：去回跳地址（只认控制台里的站内地址），没有就去用量页 */
  const enterConsole = () => {
    const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
    router.replace(next);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const found = validate();
    // 焦点落在第一个出错的输入框（顺序：邮箱 → 密码）
    const firstField = (['email', 'password'] as const).find((field) => found[field]);
    if (firstField) {
      setErrors(found);
      document.getElementById(firstField)?.focus();
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const result = await signIn(values.email.trim(), values.password);
    if (result.kind === 'signed_in') {
      enterConsole();
      return;
    }
    setSubmitting(false);
    if (result.kind === 'requires_2fa') {
      setStep({ kind: 'two_factor', emailMasked: result.emailMasked });
      return;
    }
    setFormError(messageFor(result.reason));
    if (result.reason === 'INVALID_CREDENTIALS') {
      setValues((current) => ({ ...current, password: '' }));
      document.getElementById('password')?.focus();
    }
  };

  const describedBy = (field: keyof LoginErrors, id: string) =>
    errors[field] ? `${id}-error` : undefined;

  return (
    <section id="login" className="flex min-h-dvh flex-col px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {/* 登录注册页没有顶栏，语言与主题切换放在表单顶栏这一行 */}
        <div className="flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center py-12">
          {step.kind === 'two_factor' ? (
            <LoginTwoFactor
              emailMasked={step.emailMasked}
              onSignedIn={enterConsole}
              onExpired={(message) => {
                setStep({ kind: 'credentials' });
                setValues((current) => ({ ...current, password: '' }));
                setFormError(message);
              }}
            />
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {t('login.title')}
              </h1>

              <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-5" data-login-form>
                <Field label={t('fields.email')} htmlFor="email" error={errors.email}>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    data-login-email
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={values.email}
                    onChange={(event) => setValue('email', event.target.value)}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={describedBy('email', 'email')}
                    className="min-w-0"
                  />
                </Field>

                <AuthPasswordInput
                  id="password"
                  name="password"
                  value={values.password}
                  onChange={(value) => setValue('password', value)}
                  error={errors.password}
                  autoComplete="current-password"
                  dataAttribute="data-login-password"
                />

                <AuthFormAlert message={formError} />

                <Button type="submit" block loading={submitting} data-login-submit>
                  {t('login.submit')}
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                {t('login.noAccount')}{' '}
                <Link
                  href="/register"
                  data-to-register
                  className="font-medium text-foreground hover:underline"
                >
                  {t('login.toRegister')}
                </Link>
              </p>

              <p className="mt-8 text-center text-xs leading-5 text-subtle-foreground">
                {t.rich('login.terms', {
                  terms: (chunks) => (
                    <a href="#" className="underline underline-offset-4 hover:text-foreground">
                      {chunks}
                    </a>
                  ),
                  privacy: (chunks) => (
                    <a href="#" className="underline underline-offset-4 hover:text-foreground">
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default LoginPanel;
