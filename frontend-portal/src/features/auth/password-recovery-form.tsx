'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from './auth-provider';
import { CaptchaChallenge } from './captcha-challenge';
import type { AuthSettings, CaptchaProof } from './types';

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : fallback;
}

function hasCaptcha(settings: AuthSettings): boolean {
  return (
    settings.turnstileSiteKey !== null || settings.tencentAppId !== null || settings.aliyun !== null
  );
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());
}

export interface PasswordRecoveryFormProps {
  mode: 'forgot' | 'reset';
  settings: AuthSettings;
  email?: string;
  token?: string;
}

export function PasswordRecoveryForm({
  mode,
  settings,
  email: initialEmail,
  token,
}: PasswordRecoveryFormProps) {
  const router = useRouter();
  const { request } = useAuth();
  const [email, setEmail] = useState(initialEmail ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [proof, setProof] = useState<CaptchaProof | undefined>();
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetCaptcha = (): void => {
    setProof(undefined);
    setCaptchaResetKey((value) => value + 1);
  };

  const submitForgot = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy || sent) return;
    const normalizedEmail = email.trim();
    if (!validEmail(normalizedEmail)) {
      setError('请输入有效的邮箱地址');
      return;
    }
    if (hasCaptcha(settings) && proof === undefined) {
      setError('请先完成安全验证');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await request('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: { email: normalizedEmail, ...(proof ?? {}) },
      });
      setSent(true);
    } catch (submitError) {
      resetCaptcha();
      setError(errorText(submitError, '邮件发送失败，请稍后重试'));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy || resetDone) return;
    if (token === undefined || token.trim() === '') {
      setError('重置链接无效或已过期');
      return;
    }
    const normalizedEmail = email.trim();
    if (!validEmail(normalizedEmail)) {
      setError('请输入有效的邮箱地址');
      return;
    }
    if (newPassword.length < 6) {
      setError('密码至少需要6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await request('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: {
          email: normalizedEmail,
          token: token.trim(),
          new_password: newPassword,
        },
      });
      setResetDone(true);
    } catch (submitError) {
      setError(errorText(submitError, '密码重置失败，请重新打开邮件中的链接'));
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'forgot' && sent) {
    return (
      <div className="space-y-5">
        <Alert
          title="邮件已发送"
          description="如果邮箱已注册，你会收到密码恢复邮件，请检查收件箱。"
        />
        <p className="text-sm text-muted-foreground">没有收到邮件？确认邮箱地址后可以重新提交。</p>
        <Button type="button" variant="outline" className="w-full" onClick={() => setSent(false)}>
          返回修改邮箱
        </Button>
        <a
          href="/login"
          className="block text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          返回登录
        </a>
      </div>
    );
  }

  if (mode === 'reset' && resetDone) {
    return (
      <div className="space-y-5">
        <Alert title="密码已重置" description="请使用新密码登录。" />
        <Button type="button" className="w-full" onClick={() => router.replace('/login')}>
          前往登录
        </Button>
      </div>
    );
  }

  if (mode === 'reset' && (token === undefined || token.trim() === '')) {
    return (
      <div className="space-y-5">
        <Alert variant="destructive" title="重置链接无效或已过期" />
        <a
          href="/forgot-password"
          className="block text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          重新申请重置链接
        </a>
      </div>
    );
  }

  const submit = mode === 'forgot' ? submitForgot : submitReset;
  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)} noValidate>
      {error !== null ? <Alert variant="destructive" title={error} /> : null}
      <div className="space-y-2">
        <Label htmlFor="recovery-email">邮箱</Label>
        <Input
          id="recovery-email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (mode === 'forgot') setSent(false);
          }}
          autoComplete="email"
          readOnly={mode === 'reset' && initialEmail !== undefined}
          required
        />
      </div>

      {mode === 'reset' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="reset-new-password">新密码</Label>
            <Input
              id="reset-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-confirm-password">确认新密码</Label>
            <Input
              id="reset-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
        </>
      ) : null}

      {mode === 'forgot' ? (
        <CaptchaChallenge
          settings={settings}
          resetKey={captchaResetKey}
          onProof={(nextProof) => setProof(nextProof ?? undefined)}
        />
      ) : null}

      <Button type="submit" className="w-full" loading={busy} disabled={busy}>
        {mode === 'forgot' ? '发送恢复邮件' : '重置密码'}
      </Button>
      <a
        href="/login"
        className="block text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        返回登录
      </a>
    </form>
  );
}
