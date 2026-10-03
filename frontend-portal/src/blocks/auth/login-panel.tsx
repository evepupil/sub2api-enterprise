'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { AuthPasswordInput } from '@/blocks/auth/auth-password-input';
import { Brand } from '@/components/layout/brand';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 提交成功后的加载时长（规格：1200ms 后按钮恢复），卸载时清掉定时器 */
const SUBMIT_DELAY_MS = 1200;

type LoginErrors = Partial<Record<'email' | 'password', string>>;

/**
 * 登录表单：个人与组织成员都用邮箱和密码登录，界面不区分账号类型。
 * 受控输入、按顺序校验、提交加载态；后端不接，只做前端校验。
 */
export function LoginPanel() {
  const t = useTranslations('auth');
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setValue = (key: 'email' | 'password', value: string) => {
    // 输入即清掉该字段的错误
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  // 组件卸载时清掉提交定时器，避免对已卸载组件 setState
  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => () => clearTimer(), []);

  /** 按规格顺序校验每个字段，每个字段只报它的第一条错误；所有出错字段同时标红 */
  const validate = (): LoginErrors => {
    const next: LoginErrors = {};
    if (values.email.trim() === '') {
      next.email = t('fields.errors.emailRequired');
    } else if (!EMAIL_PATTERN.test(values.email)) {
      next.email = t('fields.errors.emailInvalid');
    }
    if (values.password === '') {
      next.password = t('fields.errors.passwordRequired');
    } else if (values.password.length < 8) {
      next.password = t('fields.errors.passwordShort');
    }
    return next;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
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
    // 校验通过：进入加载态 1.2 秒再恢复，不跳转、不弹提示
    setSubmitting(true);
    timerRef.current = setTimeout(() => setSubmitting(false), SUBMIT_DELAY_MS);
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
                <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                  {t('login.forgot')}
                </a>
              }
            />

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

          <div className="my-8 flex items-center gap-4 text-xs text-subtle-foreground">
            <span className="h-px flex-1 bg-border" />
            {t('divider')}
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* 谷歌登录为占位，点击不做任何事 */}
          <Button type="button" variant="secondary" block data-google-login>
            <img src="/brands/google.svg" alt="" aria-hidden width={16} height={16} />
            {t('login.google')}
          </Button>

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
        </div>
      </div>
    </section>
  );
}

export default LoginPanel;
