'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from './auth-provider';
import { CaptchaChallenge } from './captcha-challenge';
import { OptionalSignIn } from './optional-sign-in';
import { safeReturnPath } from './redirect';
import type { AuthSettings, CaptchaProof, LoginChallenge } from './types';

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : fallback;
}

function hasCaptcha(settings: AuthSettings): boolean {
  return (
    settings.turnstileSiteKey !== null || settings.tencentAppId !== null || settings.aliyun !== null
  );
}

function routeWithNext(path: string, nextPath: string | undefined): string {
  const safePath = safeReturnPath(nextPath);
  return safePath === '/console' ? path : `${path}?next=${encodeURIComponent(safePath)}`;
}

export interface LoginFormProps {
  settings: AuthSettings;
  nextPath?: string;
}

export function LoginForm({ settings, nextPath }: LoginFormProps) {
  const router = useRouter();
  const { login, completeTwoFactor } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [proof, setProof] = useState<CaptchaProof | undefined>();
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetCaptcha = (): void => {
    setProof(undefined);
    setCaptchaResetKey((value) => value + 1);
  };

  const redirectAfterLogin = (): void => {
    router.replace(safeReturnPath(nextPath));
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalizedEmail)) {
      setError('请输入有效的邮箱地址');
      return;
    }
    if (password.length === 0) {
      setError('请输入密码');
      return;
    }
    if (hasCaptcha(settings) && proof === undefined) {
      setError('请先完成安全验证');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await login({ email: normalizedEmail, password, ...(proof ?? {}) });
      if (result === null) {
        redirectAfterLogin();
      } else {
        setChallenge(result);
        setTotpCode('');
      }
    } catch (submitError) {
      resetCaptcha();
      setError(errorText(submitError, '登录失败，请检查邮箱和密码后重试'));
    } finally {
      setBusy(false);
    }
  };

  const submitTwoFactor = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy || challenge === null) return;
    if (!/^\d{6}$/u.test(totpCode)) {
      setError('请输入6位验证码');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await completeTwoFactor(challenge.tempToken, totpCode);
      redirectAfterLogin();
    } catch (submitError) {
      setError(errorText(submitError, '验证码不正确或已失效，请重试'));
    } finally {
      setBusy(false);
    }
  };

  if (challenge !== null) {
    return (
      <form className="space-y-5" onSubmit={(event) => void submitTwoFactor(event)} noValidate>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {challenge.maskedEmail !== ''
              ? `验证码已发送至 ${challenge.maskedEmail}`
              : '请输入验证器中的6位验证码'}
          </p>
        </div>
        {error !== null ? <Alert variant="destructive" title={error} /> : null}
        <div className="space-y-2">
          <Label htmlFor="login-totp">6位验证码</Label>
          <Input
            id="login-totp"
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value.replace(/\D/gu, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-invalid={error !== null}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-2">
          <Button type="submit" className="w-full" loading={busy} disabled={busy}>
            完成登录
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => {
              setChallenge(null);
              setError(null);
              setTotpCode('');
              resetCaptcha();
            }}
          >
            返回密码登录
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <form className="space-y-4" onSubmit={(event) => void submitPassword(event)} noValidate>
        {error !== null ? <Alert variant="destructive" title={error} /> : null}
        <div className="space-y-2">
          <Label htmlFor="login-email">邮箱</Label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            aria-invalid={error !== null}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="login-password">密码</Label>
            {settings.passwordResetEnabled ? (
              <a
                href={routeWithNext('/forgot-password', nextPath)}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                忘记密码？
              </a>
            ) : null}
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="pr-12"
              aria-invalid={error !== null}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
        </div>
        <CaptchaChallenge
          settings={settings}
          resetKey={captchaResetKey}
          onProof={(nextProof) => setProof(nextProof ?? undefined)}
        />
        <Button type="submit" className="w-full" loading={busy} disabled={busy}>
          登录
        </Button>
      </form>

      <OptionalSignIn settings={settings} proof={proof} nextPath={nextPath} onError={setError} />

      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {settings.registrationEnabled ? (
          <a
            href={routeWithNext('/register', nextPath)}
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            创建账号
          </a>
        ) : null}
      </div>
    </div>
  );
}
