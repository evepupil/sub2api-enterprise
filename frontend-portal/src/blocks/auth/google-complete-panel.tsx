'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { AuthFormAlert } from '@/blocks/auth/auth-form-alert';
import { AuthLegalNote } from '@/blocks/auth/auth-legal-note';
import { AuthPanelFrame } from '@/blocks/auth/auth-panel-frame';
import { Button } from '@/components/ui/button';
import { buttonClass } from '@/components/ui/button-styles';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Link, useRouter } from '@/i18n/navigation';
import { clearReferralCode, loadReferralCode } from '@/lib/auth/affiliate';
import {
  clearGoogleDraft,
  completeGoogleRegistration,
  fetchGooglePending,
  loadGoogleDraft,
} from '@/lib/auth/google-oauth';
import { checkInvitationCode } from '@/lib/auth/register-client';
import {
  EMPTY_REGISTER_VALUES,
  IDLE,
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

import { RegisterFields } from './register-fields';
import { useRegisterMessages } from './use-register-messages';

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; invitationRequired: boolean }
  | { kind: 'expired' }
  | { kind: 'error'; reason: AuthErrorReason };

type AccountValue = 'personal' | 'organization';

const FIELD_INPUT_ID: Record<RegisterField, string> = {
  orgName: 'org-name',
  email: 'email',
  password: 'password',
  invite: 'invite',
  memberName: 'member-name',
};

/**
 * 谷歌登录的新用户完成注册（/register/google）：后台不会直接建号，要设一个登录密码，
 * 后台要求邀请码时填邀请码，也可以在这里选创建组织或凭组织邀请码加入（规则同注册页，见 register-form.ts）。
 * 邮箱是谷歌邮箱、只读，不用邮箱验证码（谷歌已验证）。注册页点过谷歌注册的话，已填的内容预填进来。
 * 待完成会话过期（10 分钟）时提示重新用谷歌登录。成功即为登录状态，进控制台。
 */
export function GoogleCompletePanel() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { loaded, settings } = useAuthSettings();
  const messages = useRegisterMessages(settings);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [chosenAccount, setChosenAccount] = useState<AccountValue>('personal');
  const [values, setValues] = useState<RegisterValues>(EMPTY_REGISTER_VALUES);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const invite = useCodeCheck(checkInvitationCode);

  // 打开时读谷歌邮箱与是否必须填邀请码，再用注册页存下的草稿预填
  useEffect(() => {
    let cancelled = false;
    void fetchGooglePending().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoad(
          result.reason === 'OAUTH_SESSION_EXPIRED'
            ? { kind: 'expired' }
            : { kind: 'error', reason: result.reason },
        );
        return;
      }
      const draft = loadGoogleDraft();
      setValues({
        ...EMPTY_REGISTER_VALUES,
        email: result.email,
        orgName: draft?.orgName ?? '',
        memberName: draft?.memberName ?? '',
        invite: draft?.invite ?? '',
        aff: draft?.aff || loadReferralCode(),
      });
      if (draft?.account === 'organization') setChosenAccount('organization');
      setLoad({ kind: 'ready', invitationRequired: result.invitationRequired });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const orgInvite = isOrganizationInvitation(invite.check);
  // 组织邀请码只能加入组织，不能再创建
  const account: AccountValue = orgInvite ? 'personal' : chosenAccount;
  const context: RegisterContext = useMemo(
    () => ({
      settings: {
        ...settings,
        invitationCodeEnabled:
          settings.invitationCodeEnabled || (load.kind === 'ready' && load.invitationRequired),
      },
      creatingOrganization: account === 'organization',
      invitation: invite.check,
    }),
    [settings, load, account, invite.check],
  );
  const creatingOrganization = isCreatingOrganization(context);

  const setValue = (key: keyof RegisterValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
    if (key === 'invite') invite.onInput(value);
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as RegisterField];
      return next;
    });
  };

  const switchAccount = (next: AccountValue) => {
    if (next !== chosenAccount) {
      setErrors({});
      setFormError(null);
    }
    setChosenAccount(next);
  };

  const showErrors = (found: RegisterErrors) => {
    setErrors(found);
    const first = REGISTER_FIELD_ORDER.find((field) => found[field]);
    if (first) document.getElementById(FIELD_INPUT_ID[first])?.focus();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !loaded || load.kind !== 'ready') return;
    setFormError(null);

    const found = validateRegister(values, context);
    if (REGISTER_FIELD_ORDER.some((field) => found[field])) {
      showErrors(found);
      return;
    }
    const block = submitBlockFor(values, IDLE, invite.check);
    if (block) {
      setFormError(messages.blockMessage(block));
      return;
    }

    setSubmitting(true);
    let ctx = context;
    // 邀请码填了却还没校验（预填的或刚输完）：先校验一次再决定
    if (values.invite.trim() !== '' && invite.check.status === 'idle') {
      const checked = await invite.checkNow(values.invite);
      if (checked.status !== 'valid') {
        setSubmitting(false);
        setFormError(messages.blockMessage('inviteInvalid'));
        return;
      }
      ctx = { ...context, invitation: checked };
      const again = validateRegister(values, ctx);
      if (REGISTER_FIELD_ORDER.some((field) => again[field])) {
        setSubmitting(false);
        showErrors(again);
        return;
      }
    }

    const payload = registerPayload(values, ctx);
    const result = await completeGoogleRegistration({
      password: payload.password,
      invitationCode: payload.invitationCode,
      organizationName: payload.organizationName,
      organizationMemberName: payload.organizationMemberName,
      affCode: payload.affCode,
    });
    if (result.ok) {
      clearGoogleDraft();
      clearReferralCode();
      router.replace('/console/usage');
      return;
    }
    setSubmitting(false);
    if (result.reason === 'OAUTH_SESSION_EXPIRED') {
      setLoad({ kind: 'expired' });
      return;
    }
    setFormError(messages.reasonMessage(result.reason));
  };

  const closed = loaded && !settings.registrationEnabled;

  return (
    <AuthPanelFrame id="google-complete">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {t('googleComplete.title')}
      </h1>

      {load.kind === 'loading' ? (
        <p data-google-loading className="mt-8 text-sm text-muted-foreground">
          {t('googleComplete.loading')}
        </p>
      ) : null}

      {load.kind === 'expired' || load.kind === 'error' ? (
        <div data-google-expired className="mt-8 space-y-6">
          <AuthFormAlert
            message={
              load.kind === 'expired'
                ? t('register.errors.OAUTH_SESSION_EXPIRED')
                : messages.reasonMessage(load.reason)
            }
          />
          <Link href="/login" className={buttonClass({ variant: 'secondary', block: true })}>
            {t('googleComplete.restart')}
          </Link>
        </div>
      ) : null}

      {load.kind === 'ready' && closed ? (
        <p
          data-register-closed
          className="mt-8 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground"
        >
          {t('register.closed')}
        </p>
      ) : null}

      {load.kind === 'ready' && !closed ? (
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
            data-google-complete-form
          >
            <RegisterFields
              settings={context.settings}
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
              promoStatus={null}
              emailLocked
              showPromo={false}
            />

            <AuthFormAlert message={formError} />

            <Button
              type="submit"
              block
              loading={submitting}
              disabled={!loaded}
              data-google-complete-submit
            >
              {creatingOrganization
                ? t('register.submitOrganization')
                : t('register.submitPersonal')}
            </Button>
          </form>

          <AuthLegalNote action="register" />
        </>
      ) : null}
    </AuthPanelFrame>
  );
}

export default GoogleCompletePanel;
