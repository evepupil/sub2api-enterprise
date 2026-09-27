'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from './auth-provider';
import { useAuthSettings } from './auth-settings';
import {
  acceptOAuthLogin,
  errorMessage,
  isRecordValue,
  OAUTH_PROVIDER_STORAGE_KEY,
  readSavedNextPath,
  safeOAuthRedirect,
} from './oauth-utils';
import {
  genericOAuthError,
  hasCaptcha,
  invalidOAuthResponseError,
  parseOAuthFragment,
  pendingMode,
  providerFromPath,
  type AdoptionDecision,
  type PendingMode,
} from './oauth-response';
import type { AuthSettings, CaptchaProof } from './types';

export interface OAuthCallbackState {
  mode: PendingMode;
  busy: boolean;
  message: string;
  settings: AuthSettings | undefined;
  settingsError: boolean;
  settingsReady: boolean;
  registrationNeedsEmailCode: boolean;
  captchaEnabled: boolean;
  providerName: string;
  email: string;
  password: string;
  confirmPassword: string;
  verifyCode: string;
  verifySent: boolean;
  verifyCountdown: number;
  invitationCode: string;
  bindEmail: string;
  bindPassword: string;
  totpCode: string;
  proof: CaptchaProof | undefined;
  captchaResetKey: number;
  agreed: boolean;
  suggestedName: string;
  suggestedAvatar: string;
  adoptName: boolean;
  adoptAvatar: boolean;
  createAllowed: boolean;
  bindAllowed: boolean;
  agreementOpen: boolean;
  setMode: (mode: PendingMode) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  setVerifyCode: (value: string) => void;
  setInvitationCode: (value: string) => void;
  setBindEmail: (value: string) => void;
  setBindPassword: (value: string) => void;
  setTotpCode: (value: string) => void;
  setProof: (value: CaptchaProof | undefined) => void;
  setAgreed: (value: boolean) => void;
  setAdoptName: (value: boolean) => void;
  setAdoptAvatar: (value: boolean) => void;
  setAgreementOpen: (value: boolean) => void;
  submitCreateAccount: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  submitBindLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  submitTotp: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  submitAdoption: () => Promise<void>;
  sendVerifyCode: () => Promise<void>;
  navigate: (path?: unknown) => void;
}

export function useOAuthCallback(): OAuthCallbackState {
  const auth = useAuth();
  const authSettings = useAuthSettings();
  const router = useRouter();
  const flowIdentity = useRef('');
  const nextPath = useRef('/console');
  const provider = useRef('');
  const currentIdentity = useRef(auth.identityKey);
  const started = useRef(false);

  const [mode, setMode] = useState<PendingMode>('processing');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('正在完成第三方登录…');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [bindEmail, setBindEmail] = useState('');
  const [bindPassword, setBindPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [verifySent, setVerifySent] = useState(false);
  const [verifyCountdown, setVerifyCountdown] = useState(0);
  const [proof, setProof] = useState<CaptchaProof | undefined>();
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [suggestedName, setSuggestedName] = useState('');
  const [suggestedAvatar, setSuggestedAvatar] = useState('');
  const [adoptName, setAdoptName] = useState(true);
  const [adoptAvatar, setAdoptAvatar] = useState(true);
  const [createAllowed, setCreateAllowed] = useState(true);
  const [bindAllowed, setBindAllowed] = useState(true);
  const [providerName, setProviderName] = useState('');
  const [agreementOpen, setAgreementOpen] = useState(false);

  const settings = authSettings.data;
  const settingsReady = !authSettings.isLoading && !authSettings.isError && settings !== undefined;
  const verifyEnabled = settings?.emailVerifyEnabled === true;
  const captchaEnabled = settings !== undefined && hasCaptcha(settings);
  const directEmailProvider = providerName === 'github' || providerName === 'google';
  const registrationNeedsEmailCode = verifyEnabled && !directEmailProvider;

  useEffect(() => {
    currentIdentity.current = auth.identityKey;
  }, [auth.identityKey]);

  useEffect(() => {
    if (verifyCountdown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setVerifyCountdown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [verifyCountdown]);

  const resetCaptcha = (): void => {
    setProof(undefined);
    setCaptchaResetKey((value) => value + 1);
  };

  const setProviderValue = (value: string): void => {
    provider.current = value;
    setProviderName(value);
  };

  const decision = (): AdoptionDecision => ({
    adopt_display_name: adoptName,
    adopt_avatar: adoptAvatar,
  });

  const fail = (error: unknown, fallback = '第三方登录失败，请重试'): void => {
    setMessage(errorMessage(error, fallback));
    setMode('error');
    setBusy(false);
  };

  const navigate = (path?: unknown): void => {
    router.replace(
      safeOAuthRedirect(typeof path === 'string' ? path : nextPath.current, nextPath.current),
    );
  };

  const processCompletion = async (response: unknown): Promise<void> => {
    if (currentIdentity.current !== flowIdentity.current) {
      throw new Error('当前登录身份已变化，请重新操作。');
    }
    if (!isRecordValue(response)) {
      throw new Error(invalidOAuthResponseError());
    }

    if (typeof response.provider === 'string' && response.provider.trim() !== '') {
      setProviderValue(response.provider.trim().toLowerCase());
    }
    if (typeof response.create_account_allowed === 'boolean') {
      setCreateAllowed(response.create_account_allowed);
    }
    if (typeof response.existing_account_bindable === 'boolean') {
      setBindAllowed(response.existing_account_bindable);
    }
    const returnedPath = safeOAuthRedirect(
      typeof response.redirect === 'string' ? response.redirect : nextPath.current,
      nextPath.current,
    );
    const token = response.access_token ?? response.accessToken;
    if (typeof token === 'string' && token.trim() !== '') {
      await acceptOAuthLogin(
        auth.request,
        auth.acceptLogin,
        response,
        flowIdentity.current,
        () => currentIdentity.current,
      );
      try {
        window.sessionStorage.removeItem(OAUTH_PROVIDER_STORAGE_KEY);
      } catch {
        // Storage can be disabled; the consumed fragment is still gone.
      }
      router.replace(returnedPath);
      return;
    }

    if (response.requires_2fa === true && typeof response.temp_token === 'string') {
      setTempToken(response.temp_token);
      setTotpCode('');
      setMode('totp');
      setMessage('请输入身份验证器中的 6 位验证码');
      return;
    }

    const action = pendingMode(response);
    if (action !== null) {
      const accountEmail =
        response.pending_email ??
        response.existing_account_email ??
        response.resolved_email ??
        response.email ??
        response.suggested_email;
      if (typeof accountEmail === 'string') {
        setEmail(accountEmail.trim());
        setBindEmail(accountEmail.trim());
      }
      if (response.error === 'invitation_required') {
        setMessage('此登录需要邀请码，请填写邮箱、密码和邀请码以继续。');
      } else if (action === 'email-completion') {
        setMessage('请补充邮箱地址以继续登录。');
      } else {
        setMessage(action === 'choose' ? '请选择后续操作。' : '请完成以下账户操作。');
      }
      setMode(action);
      return;
    }

    const name =
      typeof response.suggested_display_name === 'string' ? response.suggested_display_name : '';
    const avatar =
      typeof response.suggested_avatar_url === 'string' ? response.suggested_avatar_url : '';
    if (response.adoption_required === true && (name !== '' || avatar !== '')) {
      setSuggestedName(name);
      setSuggestedAvatar(avatar);
      setAdoptName(name !== '');
      setAdoptAvatar(avatar !== '');
      setMode('adoption');
      setMessage('确认是否使用第三方账号提供的资料。');
      return;
    }

    if (response.auth_result === 'bind' || response.bind_completed === true) {
      setMode('completed');
      setMessage('第三方账号绑定已完成。');
      return;
    }
    if (response.auth_result === 'pending_session') {
      setMessage('请完成待处理的账号操作。');
      setMode('choose');
      return;
    }
    throw new Error(invalidOAuthResponseError());
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const url = new URL(window.location.href);
    nextPath.current = safeOAuthRedirect(
      url.searchParams.get('next') ?? readSavedNextPath('/console'),
      '/console',
    );
    let detectedProvider = providerFromPath(url.pathname);
    if (detectedProvider === '') {
      try {
        detectedProvider = window.sessionStorage.getItem(OAUTH_PROVIDER_STORAGE_KEY) ?? '';
      } catch {
        detectedProvider = '';
      }
    }
    setProviderValue(detectedProvider);
    flowIdentity.current = currentIdentity.current;

    const clearCallbackData = (): void => {
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
    };
    const fragment = parseOAuthFragment(url);
    const queryError = url.searchParams.get('error') ?? url.searchParams.get('error_description');
    if (queryError !== null || fragment.hasError) {
      clearCallbackData();
      setMessage(genericOAuthError());
      setMode('error');
      return;
    }
    if (fragment.tokenResponse !== null) {
      clearCallbackData();
      void acceptOAuthLogin(
        auth.request,
        auth.acceptLogin,
        fragment.tokenResponse,
        flowIdentity.current,
        () => currentIdentity.current,
      )
        .then(() => {
          try {
            window.sessionStorage.removeItem(OAUTH_PROVIDER_STORAGE_KEY);
          } catch {
            // The token fragment was already removed from the address bar.
          }
          router.replace(safeOAuthRedirect(fragment.redirect, nextPath.current));
        })
        .catch((error: unknown) => fail(error));
      return;
    }
    if (url.searchParams.get('code') && url.searchParams.get('state') && detectedProvider !== '') {
      const providerCallback = new URLSearchParams(url.searchParams);
      clearCallbackData();
      window.location.replace(
        `/api/portal/auth/oauth/${encodeURIComponent(detectedProvider)}/callback?${providerCallback.toString()}`,
      );
      return;
    }

    clearCallbackData();
    void auth
      .request<unknown>('/auth/oauth/pending/exchange', {
        method: 'POST',
        auth: false,
        body: {},
      })
      .then(processCompletion)
      .catch((error: unknown) => fail(error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAdoption = async (): Promise<void> => {
    setBusy(true);
    try {
      const response = await auth.request<unknown>('/auth/oauth/pending/exchange', {
        method: 'POST',
        auth: false,
        body: decision(),
      });
      await processCompletion(response);
    } catch (error: unknown) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const submitCreateAccount = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!settingsReady) {
      setMessage('认证设置仍在加载或暂时不可用，请稍后重试。');
      return;
    }
    if (password.length < 6) {
      setMessage('密码至少需要6位。');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('两次输入的密码不一致。');
      return;
    }
    if (email.trim() === '') {
      setMessage('请输入邮箱地址。');
      return;
    }
    if (registrationNeedsEmailCode && verifyCode.trim() === '') {
      setMessage('请输入邮箱验证码。');
      return;
    }
    if (captchaEnabled && proof === undefined) {
      setMessage('请先完成安全验证。');
      return;
    }
    if (settings.agreement.enabled && !agreed) {
      setMessage('请阅读并同意相关协议。');
      return;
    }
    setBusy(true);
    try {
      const directProvider = provider.current === 'github' || provider.current === 'google';
      const path = directProvider
        ? `/auth/oauth/${provider.current}/complete-registration`
        : '/auth/oauth/pending/create-account';
      const body: Record<string, unknown> = directProvider
        ? {
            password,
            ...(invitationCode.trim() ? { invitation_code: invitationCode.trim() } : {}),
          }
        : {
            email: email.trim(),
            password,
            ...(verifyCode.trim() ? { verify_code: verifyCode.trim() } : {}),
            ...(invitationCode.trim() ? { invitation_code: invitationCode.trim() } : {}),
            ...(proof ?? {}),
            ...decision(),
          };
      const response = await auth.request<unknown>(path, {
        method: 'POST',
        auth: false,
        body,
      });
      await processCompletion(response);
    } catch (error: unknown) {
      resetCaptcha();
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const submitBindLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await auth.request<unknown>('/auth/oauth/pending/bind-login', {
        method: 'POST',
        auth: false,
        body: { email: bindEmail.trim(), password: bindPassword, ...decision() },
      });
      await processCompletion(response);
    } catch (error: unknown) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const sendVerifyCode = async (): Promise<void> => {
    if (!email.trim()) {
      setMessage('请先填写邮箱地址。');
      setMode('create-account');
      return;
    }
    if (!settingsReady || !registrationNeedsEmailCode) {
      setMessage('邮箱验证设置暂时不可用，请稍后重试。');
      return;
    }
    if (captchaEnabled && proof === undefined) {
      setMessage('请先完成安全验证。');
      return;
    }
    setBusy(true);
    try {
      const result = await auth.request<unknown>('/auth/oauth/pending/send-verify-code', {
        method: 'POST',
        auth: false,
        body: { email: email.trim(), ...(proof ?? {}) },
      });
      setVerifySent(true);
      const returned = isRecordValue(result) ? result.countdown : undefined;
      setVerifyCountdown(
        typeof returned === 'number' && Number.isFinite(returned)
          ? Math.max(1, Math.floor(returned))
          : 60,
      );
      resetCaptcha();
      setMessage('验证码已发送。');
    } catch (error: unknown) {
      resetCaptcha();
      fail(error, '验证码发送失败');
    } finally {
      setBusy(false);
    }
  };

  const submitTotp = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!tempToken || totpCode.trim().length !== 6) return;
    setBusy(true);
    try {
      const response = await auth.request<unknown>('/auth/login/2fa', {
        method: 'POST',
        auth: false,
        body: { temp_token: tempToken, totp_code: totpCode.trim() },
      });
      await acceptOAuthLogin(
        auth.request,
        auth.acceptLogin,
        response,
        flowIdentity.current,
        () => currentIdentity.current,
      );
      router.replace(safeOAuthRedirect(nextPath.current));
    } catch (error: unknown) {
      fail(error, '身份验证失败');
    } finally {
      setBusy(false);
    }
  };

  return {
    mode,
    busy,
    message,
    settings,
    settingsError: authSettings.isError,
    settingsReady,
    registrationNeedsEmailCode,
    captchaEnabled,
    providerName,
    email,
    password,
    confirmPassword,
    verifyCode,
    verifySent,
    verifyCountdown,
    invitationCode,
    bindEmail,
    bindPassword,
    totpCode,
    proof,
    captchaResetKey,
    agreed,
    suggestedName,
    suggestedAvatar,
    adoptName,
    adoptAvatar,
    createAllowed,
    bindAllowed,
    agreementOpen,
    setMode,
    setEmail,
    setPassword,
    setConfirmPassword,
    setVerifyCode,
    setInvitationCode,
    setBindEmail,
    setBindPassword,
    setTotpCode,
    setProof,
    setAgreed,
    setAdoptName,
    setAdoptAvatar,
    setAgreementOpen,
    submitCreateAccount,
    submitBindLogin,
    submitTotp,
    submitAdoption,
    sendVerifyCode,
    navigate,
  };
}
