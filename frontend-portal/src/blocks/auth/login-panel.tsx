'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { AuthFormAlert } from '@/blocks/auth/auth-form-alert';
import { AuthGoogleButton } from '@/blocks/auth/auth-google-button';
import { AuthLegalNote } from '@/blocks/auth/auth-legal-note';
import { AuthPanelFrame } from '@/blocks/auth/auth-panel-frame';
import { AuthPasswordInput } from '@/blocks/auth/auth-password-input';
import { LoginTwoFactor } from '@/blocks/auth/login-two-factor';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Link, useRouter } from '@/i18n/navigation';
import { googleStartUrl } from '@/lib/auth/google-oauth';
import { isOAuthError } from '@/lib/auth/oauth-errors';
import { EMAIL_PATTERN } from '@/lib/auth/register-form';
import { useAuthSettings } from '@/lib/auth/use-auth-settings';
import { signIn } from '@/lib/session/client';
import { safeNextPath } from '@/lib/session/guard';
import type { AuthErrorReason } from '@/lib/session/types';
import { useUrlText } from '@/lib/use-url-state';

type LoginErrors = Partial<Record<'email' | 'password', string>>;

type Step = { kind: 'credentials' } | { kind: 'two_factor'; emailMasked: string };

/**
 * 登录表单：个人与组织成员都用邮箱和密码登录，界面不区分账号类型。
 * 提交经官网服务器转给后端；成功后进控制台（有回跳地址就回到原来要去的页）。
 * 账号开了两步验证时切到第二步输入验证码。后台开了找回密码时，密码框右上角有「忘记密码？」；
 * 后台开了谷歌登录时下面有「使用 Google 账号登录」（整页跳去官网服务器，由它替浏览器和后台、谷歌打交道），
 * 谷歌登录失败时服务器带着 ?oauth_error= 跳回这里，表单上方显示原因。
 */
export function LoginPanel() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const { settings } = useAuthSettings();
  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 谷歌登录失败跳回来时地址里带 ?oauth_error=：按原因显示提示；用户一动手（输入、提交）就从地址里去掉
  const [oauthError, setOauthError] = useUrlText('oauth_error');
  const oauthMessage = isOAuthError(oauthError) ? t(`login.oauthErrors.${oauthError}`) : null;
  const dismissOauthError = () => {
    if (oauthError !== '') setOauthError('');
  };

  const setValue = (key: 'email' | 'password', value: string) => {
    // 输入即清掉该字段的错误和整表提示
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
    dismissOauthError();
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
    dismissOauthError();
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
    <AuthPanelFrame id="login">
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
              trailing={
                settings.passwordResetEnabled ? (
                  <Link
                    href="/forgot-password"
                    data-to-forgot
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {t('login.forgot')}
                  </Link>
                ) : undefined
              }
            />

            <AuthFormAlert message={formError ?? oauthMessage} />

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

          {settings.googleOAuthEnabled ? (
            <AuthGoogleButton
              label={t('login.google')}
              dataAttribute="data-google-login"
              startUrl={() =>
                googleStartUrl({
                  locale: locale === 'en' ? 'en' : 'zh',
                  next: safeNextPath(new URLSearchParams(window.location.search).get('next')),
                })
              }
            />
          ) : null}

          <AuthLegalNote action="login" />
        </>
      )}
    </AuthPanelFrame>
  );
}

export default LoginPanel;
