'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { AuthFormAlert } from '@/blocks/auth/auth-form-alert';
import { AuthGoogleButton } from '@/blocks/auth/auth-google-button';
import { AuthLegalNote } from '@/blocks/auth/auth-legal-note';
import { AuthPanelFrame } from '@/blocks/auth/auth-panel-frame';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Link, useRouter } from '@/i18n/navigation';
import {
  clearReferralCode,
  loadReferralCode,
  referralCodeFromQuery,
  storeReferralCode,
} from '@/lib/auth/affiliate';
import { googleStartUrl, storeGoogleDraft } from '@/lib/auth/google-oauth';
import { checkInvitationCode, checkPromoCode, register } from '@/lib/auth/register-client';
import {
  EMPTY_REGISTER_VALUES,
  isCreatingOrganization,
  isOrganizationInvitation,
  needsMemberName,
  REGISTER_FIELD_ORDER,
  registerPayload,
  submitBlockFor,
  validateRegister,
  type RegisterContext,
  type RegisterErrors,
  type RegisterField,
  type RegisterValues,
} from '@/lib/auth/register-form';
import { useAuthSettings } from '@/lib/auth/use-auth-settings';
import { useCodeCheck } from '@/lib/auth/use-code-check';
import type { AuthErrorReason } from '@/lib/session/types';
import { useUrlState } from '@/lib/use-url-state';

import { RegisterFields } from './register-fields';
import { RegisterVerifyStep } from './register-verify-step';
import { useRegisterMessages } from './use-register-messages';

/** 注册类型存在网址 ?account=organization，刷新与分享链接保留所选类型 */
const ACCOUNT_VALUES = ['personal', 'organization'] as const;
type AccountValue = (typeof ACCOUNT_VALUES)[number];

/** 各字段输入框的 id，出错时把焦点放过去 */
const FIELD_INPUT_ID: Record<RegisterField, string> = {
  orgName: 'org-name',
  email: 'email',
  password: 'password',
  invite: 'invite',
  memberName: 'member-name',
};

/**
 * 注册页：规则与现有 sub2api 注册页一致（见 src/lib/auth/register-form.ts）。
 * 打开时读后端开关决定显示哪些输入框；后台开了邮箱验证时多一步验证码；注册成功即为登录状态，进控制台。
 * 网址里的 ?invite= / ?promo= / ?aff= 会自动填好并校验。
 * 后台开了谷歌登录时下面有「使用 Google 账号注册」：先把已填的注册类型、组织名称、邀请码等存在本页会话里，
 * 新用户到「完成注册」页时预填；发起时只带返利码和有效的优惠码（优惠码只能在发起时交给后台），
 * 组织与邀请码在完成注册时才提交，避免这里填过又改主意时后台按旧值建组织。
 */
export function RegisterPanel() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const { loaded, settings } = useAuthSettings();
  const messages = useRegisterMessages(settings);
  const [account, setAccount] = useUrlState('account', ACCOUNT_VALUES, 'personal');
  const [values, setValues] = useState<RegisterValues>(EMPTY_REGISTER_VALUES);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const invite = useCodeCheck(checkInvitationCode);
  const promo = useCodeCheck(checkPromoCode);
  const prefilled = useRef(false);

  const context: RegisterContext = useMemo(
    () => ({
      settings,
      creatingOrganization: account === 'organization',
      invitation: invite.check,
    }),
    [settings, account, invite.check],
  );
  const orgInvite = isOrganizationInvitation(invite.check);
  const creatingOrganization = isCreatingOrganization(context);

  // 邀请码被识别为组织邀请码：只能加入，切回个人注册（和现有注册页一致）
  useEffect(() => {
    if (orgInvite && account === 'organization') setAccount('personal');
  }, [orgInvite, account, setAccount]);

  // 读到开关后，把网址里的邀请码、优惠码、返利码填好并校验（只做一次）
  useEffect(() => {
    if (!loaded || prefilled.current) return;
    prefilled.current = true;
    const params = new URLSearchParams(window.location.search);
    const inviteParam = (params.get('invite') ?? params.get('invitation_code') ?? '').trim();
    const promoParam = settings.promoCodeEnabled ? (params.get('promo') ?? '').trim() : '';
    const queryAff = referralCodeFromQuery(window.location.search);
    if (queryAff) storeReferralCode(queryAff);
    const aff = queryAff || loadReferralCode();
    setValues((current) => ({
      ...current,
      invite: current.invite || inviteParam,
      promo: current.promo || promoParam,
      aff: current.aff || aff,
    }));
    if (inviteParam) void invite.checkNow(inviteParam);
    if (promoParam) void promo.checkNow(promoParam);
  }, [loaded, settings.promoCodeEnabled, invite, promo]);

  const setValue = (key: keyof RegisterValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
    if (key === 'invite') invite.onInput(value);
    if (key === 'promo') promo.onInput(value);
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as RegisterField];
      return next;
    });
  };

  const switchAccount = (next: AccountValue) => {
    if (next !== account) {
      setErrors({});
      setFormError(null);
    }
    setAccount(next);
  };

  /** 真正提交注册；成功跳控制台并返回 null，失败返回原因 */
  const submitRegistration = async (verifyCode?: string): Promise<AuthErrorReason | null> => {
    const result = await register(registerPayload(values, context, verifyCode));
    if (result.kind === 'signed_in') {
      clearReferralCode();
      router.replace('/console/usage');
      return null;
    }
    return result.reason;
  };

  const showErrors = (found: RegisterErrors) => {
    setErrors(found);
    const first = REGISTER_FIELD_ORDER.find((field) => found[field]);
    if (first) document.getElementById(FIELD_INPUT_ID[first])?.focus();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !loaded) return;
    setFormError(null);

    const found = validateRegister(values, context);
    if (REGISTER_FIELD_ORDER.some((field) => found[field])) {
      showErrors(found);
      return;
    }

    const block = submitBlockFor(values, promo.check, invite.check);
    if (block) {
      setFormError(messages.blockMessage(block));
      return;
    }

    setSubmitting(true);
    let ctx = context;
    // 邀请码填了却还没校验（刚输完）：先校验一次再决定
    if (values.invite.trim() !== '' && invite.check.status === 'idle') {
      const result = await invite.checkNow(values.invite);
      if (result.status !== 'valid') {
        setSubmitting(false);
        setFormError(messages.blockMessage('inviteInvalid'));
        return;
      }
      ctx = { ...context, invitation: result };
      const again = validateRegister(values, ctx);
      if (REGISTER_FIELD_ORDER.some((field) => again[field])) {
        setSubmitting(false);
        showErrors(again);
        return;
      }
    }

    if (settings.emailVerifyEnabled) {
      setSubmitting(false);
      setStep('verify');
      return;
    }

    const result = await register(registerPayload(values, ctx));
    if (result.kind === 'signed_in') {
      clearReferralCode();
      router.replace('/console/usage');
      return;
    }
    setSubmitting(false);
    setFormError(messages.reasonMessage(result.reason));
  };

  const closed = loaded && !settings.registrationEnabled;
  const submitLabel = settings.emailVerifyEnabled
    ? t('register.next')
    : creatingOrganization
      ? t('register.submitOrganization')
      : t('register.submitPersonal');

  return (
    <AuthPanelFrame id="register">
      {step === 'verify' ? (
        <RegisterVerifyStep
          email={values.email.trim()}
          submitLabel={
            creatingOrganization ? t('register.submitOrganization') : t('register.verify.submit')
          }
          reasonMessage={messages.reasonMessage}
          onSubmit={submitRegistration}
          onBack={() => setStep('form')}
        />
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('register.title')}
          </h1>

          {closed ? (
            <p
              data-register-closed
              className="mt-8 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground"
            >
              {t('register.closed')}
            </p>
          ) : (
            <>
              {orgInvite ? null : (
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
              )}

              <form
                noValidate
                onSubmit={handleSubmit}
                className="mt-6 space-y-5"
                data-register-form
              >
                <RegisterFields
                  settings={settings}
                  values={values}
                  errors={{
                    orgName: messages.fieldError(errors.orgName),
                    email: messages.fieldError(errors.email),
                    password: messages.fieldError(errors.password),
                    invite: messages.fieldError(errors.invite),
                    memberName: messages.fieldError(errors.memberName),
                  }}
                  setValue={setValue}
                  creatingOrganization={creatingOrganization}
                  showMemberName={needsMemberName(context)}
                  inviteStatus={messages.inviteStatus(invite.check)}
                  promoStatus={messages.promoStatus(promo.check)}
                />

                <AuthFormAlert message={formError} />

                <Button
                  type="submit"
                  block
                  loading={submitting}
                  disabled={!loaded}
                  data-register-submit
                >
                  {submitLabel}
                </Button>
              </form>
            </>
          )}

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

          {!closed && settings.googleOAuthEnabled ? (
            <AuthGoogleButton
              label={t('register.google')}
              dataAttribute="data-google-register"
              startUrl={() => {
                storeGoogleDraft({
                  account,
                  orgName: values.orgName,
                  memberName: values.memberName,
                  invite: values.invite,
                  aff: values.aff,
                });
                return googleStartUrl({
                  locale: locale === 'en' ? 'en' : 'zh',
                  aff: values.aff,
                  promo:
                    settings.promoCodeEnabled && promo.check.status === 'valid'
                      ? values.promo
                      : undefined,
                });
              }}
            />
          ) : null}

          {closed ? null : <AuthLegalNote action="register" />}
        </>
      )}
    </AuthPanelFrame>
  );
}

export default RegisterPanel;
