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
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Link } from '@/i18n/navigation';
import { REGISTRATION } from '@/lib/site';
import { useUrlState } from '@/lib/use-url-state';

/** 注册类型存在网址 ?account=organization，刷新与分享链接保留所选类型 */
const ACCOUNT_VALUES = ['personal', 'organization'] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 提交成功后的加载时长（规格：1200ms 后按钮恢复），卸载时清掉定时器 */
const SUBMIT_DELAY_MS = 1200;

type RegisterField = 'orgName' | 'email' | 'password' | 'invite';
type RegisterErrors = Partial<Record<RegisterField, string>>;
type AccountValue = 'personal' | 'organization';

/** 出错时焦点的先后顺序与各字段输入框的 id */
const FIELD_ORDER: readonly RegisterField[] = ['orgName', 'email', 'password', 'invite'];
const FIELD_INPUT_ID: Record<RegisterField, string> = {
  orgName: 'org-name',
  email: 'email',
  password: 'password',
  invite: 'invite',
};

/**
 * 注册表单：个人注册或创建组织，结构与登录表单一致，校验规则按规格顺序。
 * 平台开启邀请码注册时才显示邀请码，且必填（开关见 REGISTRATION）。
 */
export function RegisterPanel() {
  const t = useTranslations('auth');
  const [account, setAccount] = useUrlState('account', ACCOUNT_VALUES, 'personal');
  const [values, setValues] = useState({ orgName: '', email: '', password: '', invite: '' });
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOrganization = account === 'organization';

  /** 切身份：清空全部错误（输入值保留），组织名称框随之出现/消失 */
  const switchAccount = (next: AccountValue) => {
    if (next !== account) setErrors({});
    setAccount(next);
  };

  const setValue = (key: RegisterField, value: string) => {
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
  const validate = (): RegisterErrors => {
    const next: RegisterErrors = {};
    if (isOrganization && values.orgName.trim() === '') {
      next.orgName = t('fields.errors.orgNameRequired');
    }
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
    if (REGISTRATION.invitationCodeRequired && values.invite.trim() === '') {
      next.invite = t('fields.errors.inviteRequired');
    }
    return next;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const found = validate();
    // 焦点落在第一个出错的输入框（顺序：组织名称 → 邮箱 → 密码 → 邀请码）
    const firstField = FIELD_ORDER.find((field) => found[field]);
    if (firstField) {
      setErrors(found);
      document.getElementById(FIELD_INPUT_ID[firstField])?.focus();
      return;
    }
    // 校验通过：进入加载态 1.2 秒再恢复，不跳转、不弹提示
    setSubmitting(true);
    timerRef.current = setTimeout(() => setSubmitting(false), SUBMIT_DELAY_MS);
  };

  const describedBy = (field: keyof RegisterErrors, id: string) =>
    errors[field] ? `${id}-error` : undefined;

  return (
    <section id="register" className="flex min-h-dvh flex-col px-6 py-8 sm:px-12 lg:px-16 xl:px-24">
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
            {t('register.title')}
          </h1>

          <SegmentedControl
            name="account"
            className="mt-6 [&>button]:flex-1 [&>button]:justify-center"
            value={account}
            onChange={switchAccount}
            ariaLabel={t('account.label')}
            options={[
              { value: 'personal', label: t('account.registerPersonal') },
              { value: 'organization', label: t('account.registerOrganization') },
            ]}
          />

          <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-5" data-register-form>
            {isOrganization ? (
              <Field label={t('fields.orgName')} htmlFor="org-name" error={errors.orgName}>
                <Input
                  id="org-name"
                  name="orgName"
                  data-register-org-name
                  autoComplete="organization"
                  placeholder={t('fields.orgNamePlaceholder')}
                  value={values.orgName}
                  onChange={(event) => setValue('orgName', event.target.value)}
                  aria-invalid={errors.orgName ? true : undefined}
                  aria-describedby={describedBy('orgName', 'org-name')}
                  className="min-w-0"
                />
              </Field>
            ) : null}

            <Field
              label={isOrganization ? t('fields.adminEmail') : t('fields.email')}
              htmlFor="email"
              error={errors.email}
            >
              <Input
                id="email"
                name="email"
                type="email"
                data-register-email
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
              hint={t('fields.passwordHint')}
              autoComplete="new-password"
              dataAttribute="data-register-password"
            />

            {REGISTRATION.invitationCodeRequired ? (
              <Field label={t('fields.invite')} htmlFor="invite" error={errors.invite}>
                <Input
                  id="invite"
                  name="invite"
                  data-register-invite
                  autoComplete="off"
                  value={values.invite}
                  onChange={(event) => setValue('invite', event.target.value)}
                  aria-invalid={errors.invite ? true : undefined}
                  aria-describedby={describedBy('invite', 'invite')}
                  className="min-w-0"
                />
              </Field>
            ) : null}

            <Button type="submit" block loading={submitting} data-register-submit>
              {isOrganization ? t('register.submitOrganization') : t('register.submitPersonal')}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t('register.hasAccount')}{' '}
            <Link
              href="/login"
              data-to-login
              className="font-medium text-foreground hover:underline"
            >
              {t('register.toLogin')}
            </Link>
          </p>

          <div className="my-8 flex items-center gap-4 text-xs text-subtle-foreground">
            <span className="h-px flex-1 bg-border" />
            {t('divider')}
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* 谷歌注册为占位，点击不做任何事 */}
          <Button type="button" variant="secondary" block data-google-register>
            <img src="/brands/google.svg" alt="" aria-hidden width={16} height={16} />
            {t('register.google')}
          </Button>

          <p className="mt-8 text-center text-xs leading-5 text-subtle-foreground">
            {t.rich('register.terms', {
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

export default RegisterPanel;
