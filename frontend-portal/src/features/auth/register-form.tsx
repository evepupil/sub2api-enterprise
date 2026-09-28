'use client';

import { useEffect, useState, type FormEvent } from 'react';

import {
  SlidingIndicator,
  useSlidingIndicatorId,
} from '../../components/effects/sliding-indicator';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { cn } from '../../lib/utils';
import { AuthInput } from './auth-input';
import { useAuth } from './auth-provider';
import { CaptchaChallenge } from './captcha-challenge';
import { safeReturnPath } from './redirect';
import type { AuthSettings, CaptchaProof } from './types';
import { useRouter } from 'next/navigation';

type RegistrationMode = 'personal' | 'create' | 'join';

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : fallback;
}

function hasCaptcha(settings: AuthSettings): boolean {
  return (
    settings.turnstileSiteKey !== null || settings.tencentAppId !== null || settings.aliyun !== null
  );
}

function recordValue(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

function loginHref(nextPath: string | undefined): string {
  const safePath = safeReturnPath(nextPath);
  return safePath === '/console' ? '/login' : `/login?next=${encodeURIComponent(safePath)}`;
}

export interface RegisterFormProps {
  settings: AuthSettings;
  nextPath?: string;
  invitationCode?: string;
}

export function RegisterForm({
  settings,
  nextPath,
  invitationCode: initialInvitationCode,
}: RegisterFormProps) {
  const router = useRouter();
  const { register, request } = useAuth();
  const [mode, setMode] = useState<RegistrationMode>(initialInvitationCode ? 'join' : 'personal');
  const modeIndicatorId = useSlidingIndicatorId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [invitationCode, setInvitationCode] = useState(initialInvitationCode ?? '');
  const [verifyCode, setVerifyCode] = useState('');
  const [proof, setProof] = useState<CaptchaProof | undefined>();
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCountdown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const resetCaptcha = (): void => {
    setProof(undefined);
    setCaptchaResetKey((value) => value + 1);
  };

  const validateEmail = (): string | null => {
    const normalized = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
      return '请输入有效的邮箱地址';
    }
    if (settings.emailSuffixes.length > 0) {
      const lowerEmail = normalized.toLowerCase();
      const domain = lowerEmail.slice(lowerEmail.lastIndexOf('@') + 1);
      const allowed = settings.emailSuffixes.some((suffix) => {
        const normalizedSuffix = suffix.trim().toLowerCase().replace(/^@/u, '');
        return (
          normalizedSuffix !== '' &&
          (domain === normalizedSuffix || domain.endsWith(`.${normalizedSuffix}`))
        );
      });
      if (!allowed) {
        return `请使用允许的邮箱后缀：${settings.emailSuffixes.join('、')}`;
      }
    }
    return null;
  };

  const sendVerificationCode = async (): Promise<void> => {
    if (sendingCode || busy || countdown > 0) return;
    const emailError = validateEmail();
    if (emailError !== null) {
      setError(emailError);
      return;
    }
    if (hasCaptcha(settings) && proof === undefined) {
      setError('请先完成安全验证');
      return;
    }
    setSendingCode(true);
    setError(null);
    try {
      const result = await request<unknown>('/auth/send-verify-code', {
        method: 'POST',
        auth: false,
        body: { email: email.trim(), ...(proof ?? {}) },
      });
      const returnedCountdown = recordValue(result, 'countdown');
      const seconds =
        typeof returnedCountdown === 'number' && Number.isFinite(returnedCountdown)
          ? Math.floor(returnedCountdown)
          : 60;
      setCountdown(Math.max(1, seconds));
      setProof(undefined);
      setCaptchaResetKey((value) => value + 1);
    } catch (sendError) {
      resetCaptcha();
      setError(errorText(sendError, '验证码发送失败，请稍后重试'));
    } finally {
      setSendingCode(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    const emailError = validateEmail();
    if (emailError !== null) {
      setError(emailError);
      return;
    }
    if (password.length < 6) {
      setError('密码至少需要6位');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (mode === 'create' && organizationName.trim() === '') {
      setError('请输入组织名称');
      return;
    }
    if ((mode === 'create' || mode === 'join') && memberName.trim() === '') {
      setError('请输入成员名称');
      return;
    }
    if (mode === 'join' && invitationCode.trim() === '') {
      setError('请输入邀请码');
      return;
    }
    if (mode === 'personal' && settings.invitationCodeEnabled && invitationCode.trim() === '') {
      setError('请输入邀请码');
      return;
    }
    if (settings.emailVerifyEnabled && verifyCode.trim() === '') {
      setError('请输入邮箱验证码');
      return;
    }
    if (settings.agreement.enabled && !agreed) {
      setError('请阅读并同意相关协议');
      return;
    }
    if (hasCaptcha(settings) && proof === undefined) {
      setError('请先完成安全验证');
      return;
    }

    const body: Record<string, unknown> = {
      email: email.trim(),
      password,
      verify_code: verifyCode.trim(),
      ...(proof ?? {}),
    };
    if (mode === 'create') {
      body.organization_name = organizationName.trim();
      body.organization_member_name = memberName.trim();
    } else if (mode === 'join') {
      body.invitation_code = invitationCode.trim();
      body.organization_member_name = memberName.trim();
    } else if (settings.invitationCodeEnabled && invitationCode.trim() !== '') {
      body.invitation_code = invitationCode.trim();
    }

    setBusy(true);
    setError(null);
    try {
      await register(body);
      router.replace(safeReturnPath(nextPath));
    } catch (registerError) {
      resetCaptcha();
      setError(errorText(registerError, '注册失败，请检查填写内容后重试'));
    } finally {
      setBusy(false);
    }
  };

  const modeOptions: { value: RegistrationMode; label: string }[] = [
    { value: 'personal', label: '个人账号' },
    { value: 'create', label: '创建组织' },
    { value: 'join', label: '加入组织' },
  ];

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">注册方式</legend>
        <div className="grid grid-cols-3 gap-2 isolate" role="radiogroup" aria-label="注册方式">
          {modeOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              className={cn(
                'relative min-w-0 px-2',
                mode === option.value && 'border-transparent text-primary-foreground',
              )}
              aria-pressed={mode === option.value}
              onClick={() => {
                setMode(option.value);
                if (option.value !== 'join') setInvitationCode('');
                setError(null);
              }}
            >
              {mode === option.value ? <SlidingIndicator layoutId={modeIndicatorId} /> : null}
              <span className="sliding-indicator-label">{option.label}</span>
            </Button>
          ))}
        </div>
      </fieldset>

      <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
        {error !== null ? <Alert variant="destructive" title={error} /> : null}
        <div className="space-y-2">
          <Label htmlFor="register-email">邮箱</Label>
          <AuthInput
            id="register-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            aria-invalid={error !== null}
          />
          {settings.emailSuffixes.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              允许后缀：{settings.emailSuffixes.join('、')}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">密码</Label>
          <AuthInput
            id="register-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-confirm-password">确认密码</Label>
          <AuthInput
            id="register-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        {mode === 'create' ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="register-organization-name">组织名称</Label>
              <AuthInput
                id="register-organization-name"
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                autoComplete="organization"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-member-name">成员名称</Label>
              <AuthInput
                id="register-member-name"
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                autoComplete="nickname"
                required
              />
            </div>
          </>
        ) : null}
        {mode === 'join' ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="register-invitation-code">邀请码</Label>
              <AuthInput
                id="register-invitation-code"
                value={invitationCode}
                onChange={(event) => setInvitationCode(event.target.value)}
                autoComplete="one-time-code"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-member-name">成员名称</Label>
              <AuthInput
                id="register-member-name"
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                autoComplete="nickname"
                required
              />
            </div>
          </>
        ) : null}
        {mode === 'personal' && settings.invitationCodeEnabled ? (
          <div className="space-y-2">
            <Label htmlFor="register-personal-invitation-code">邀请码</Label>
            <AuthInput
              id="register-personal-invitation-code"
              value={invitationCode}
              onChange={(event) => setInvitationCode(event.target.value)}
              autoComplete="one-time-code"
              required
            />
          </div>
        ) : null}

        {settings.emailVerifyEnabled ? (
          <div className="space-y-2">
            <Label htmlFor="register-verify-code">邮箱验证码</Label>
            <div className="flex items-start gap-2">
              <AuthInput
                id="register-verify-code"
                value={verifyCode}
                onChange={(event) =>
                  setVerifyCode(event.target.value.replace(/\D/gu, '').slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                glowClassName="min-w-0 flex-1"
                required
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 px-3"
                loading={sendingCode}
                disabled={sendingCode || busy || countdown > 0}
                onClick={() => void sendVerificationCode()}
              >
                {countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
              </Button>
            </div>
          </div>
        ) : null}

        <CaptchaChallenge
          settings={settings}
          resetKey={captchaResetKey}
          onProof={(nextProof) => setProof(nextProof ?? undefined)}
        />

        {settings.agreement.enabled ? (
          <div className="flex items-start gap-2 text-sm">
            <input
              id="register-agreement"
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 size-4 accent-primary"
            />
            <label htmlFor="register-agreement" className="leading-relaxed text-muted-foreground">
              我已阅读并同意
              {settings.agreement.documents.map((document, index) => (
                <span key={document.id}>
                  {index > 0 ? '、' : ''}
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-foreground"
                    onClick={() => setAgreementOpen(true)}
                  >
                    {document.title}
                  </button>
                </span>
              ))}
            </label>
          </div>
        ) : null}

        <Button type="submit" className="w-full" loading={busy} disabled={busy}>
          注册
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        已有账号？{' '}
        <a
          href={loginHref(nextPath)}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          返回登录
        </a>
      </p>

      <Dialog open={agreementOpen} onOpenChange={setAgreementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>注册协议</DialogTitle>
            <DialogDescription>请阅读协议内容后再勾选同意。</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
            {settings.agreement.documents.map((document) => (
              <section key={document.id} className="space-y-2">
                <h3 className="font-medium text-foreground">{document.title}</h3>
                <p className="whitespace-pre-wrap">{document.content || '暂无正文'}</p>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
