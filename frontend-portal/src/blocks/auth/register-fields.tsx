'use client';

import { useTranslations } from 'next-intl';

import { AuthPasswordInput } from '@/blocks/auth/auth-password-input';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { RegisterField, RegisterValues } from '@/lib/auth/register-form';
import type { AuthSettings } from '@/lib/auth/settings';

import { RegisterCodeField } from './register-code-field';
import type { StatusLine } from './use-register-messages';

/**
 * 注册表单的输入项（第一步），顺序：组织名称（创建组织时）→ 邮箱 → 密码 → 邀请码 →
 * 你在组织中的名称（创建组织或凭组织邀请码加入时）→ 邀请返利码（后台开了返利时）→ 优惠码（后台开了优惠码时）。
 * 只负责画，校验与提交在 RegisterPanel 里。谷歌登录的完成注册页也用它：邮箱是谷歌邮箱、只读（emailLocked），
 * 优惠码只能在发起谷歌登录时提交，不显示（showPromo 为 false）。
 */
export function RegisterFields({
  settings,
  values,
  errors,
  setValue,
  creatingOrganization,
  showMemberName,
  inviteStatus,
  promoStatus,
  emailLocked = false,
  showPromo = true,
}: {
  settings: AuthSettings;
  values: RegisterValues;
  errors: Partial<Record<RegisterField, string>>;
  setValue: (key: keyof RegisterValues, value: string) => void;
  creatingOrganization: boolean;
  showMemberName: boolean;
  inviteStatus: StatusLine | null;
  promoStatus: StatusLine | null;
  emailLocked?: boolean;
  showPromo?: boolean;
}) {
  const t = useTranslations('auth');
  const describedBy = (field: RegisterField, id: string) =>
    errors[field] ? `${id}-error` : undefined;

  return (
    <>
      {creatingOrganization ? (
        <Field label={t('fields.orgName')} htmlFor="org-name" error={errors.orgName}>
          <Input
            id="org-name"
            name="orgName"
            data-register-org-name
            autoComplete="organization"
            maxLength={100}
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
        label={creatingOrganization ? t('fields.adminEmail') : t('fields.email')}
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
          readOnly={emailLocked}
          disabled={emailLocked}
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

      <RegisterCodeField
        id="invite"
        label={t('fields.invite')}
        optional={!settings.invitationCodeEnabled}
        value={values.invite}
        onChange={(value) => setValue('invite', value)}
        status={inviteStatus}
        error={errors.invite}
        dataAttribute="data-register-invite"
      />

      {showMemberName ? (
        <Field label={t('fields.memberName')} htmlFor="member-name" error={errors.memberName}>
          <Input
            id="member-name"
            name="memberName"
            data-register-member-name
            autoComplete="name"
            maxLength={50}
            placeholder={t('fields.memberNamePlaceholder')}
            value={values.memberName}
            onChange={(event) => setValue('memberName', event.target.value)}
            aria-invalid={errors.memberName ? true : undefined}
            aria-describedby={describedBy('memberName', 'member-name')}
            className="min-w-0"
          />
        </Field>
      ) : null}

      {settings.affiliateEnabled ? (
        <RegisterCodeField
          id="aff"
          label={t('fields.aff')}
          optional
          value={values.aff}
          onChange={(value) => setValue('aff', value)}
          status={null}
          dataAttribute="data-register-aff"
        />
      ) : null}

      {settings.promoCodeEnabled && showPromo ? (
        <RegisterCodeField
          id="promo"
          label={t('fields.promo')}
          optional
          value={values.promo}
          onChange={(value) => setValue('promo', value)}
          status={promoStatus}
          dataAttribute="data-register-promo"
        />
      ) : null}
    </>
  );
}

export default RegisterFields;
