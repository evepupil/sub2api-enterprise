'use client';

import type { ReactNode } from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuthSettings } from './auth-settings';
import { AuthLayout } from './auth-layout';
import { LoginForm } from './login-form';
import { PasswordRecoveryForm } from './password-recovery-form';
import { RegisterForm } from './register-form';

export type AuthScreenMode =
  'login' | 'register' | 'forgot' | 'reset' | 'forgot-password' | 'reset-password';

export interface AuthScreenProps {
  mode: AuthScreenMode;
  nextPath?: string;
  email?: string;
  token?: string;
  invitationCode?: string;
  children?: ReactNode;
}

function normalizedMode(mode: AuthScreenMode): 'login' | 'register' | 'forgot' | 'reset' {
  if (mode === 'forgot-password') return 'forgot';
  if (mode === 'reset-password') return 'reset';
  return mode;
}

const TITLES = {
  login: '登录',
  register: '创建账号',
  forgot: '找回密码',
  reset: '重置密码',
} as const;

export function AuthScreen({
  mode,
  nextPath,
  email,
  token,
  invitationCode,
  children,
}: AuthScreenProps) {
  const { data: settings, isLoading, isError, refetch } = useAuthSettings();
  const currentMode = normalizedMode(mode);

  return (
    <AuthLayout title={TITLES[currentMode]}>
      {isLoading ? (
        <div className="space-y-4" aria-label="正在加载认证设置">
          <Skeleton className="h-touch w-full" />
          <Skeleton className="h-touch w-full" />
          <Skeleton className="h-touch w-2/3" />
        </div>
      ) : isError || settings === undefined ? (
        <div className="space-y-4">
          <Alert variant="destructive" title="认证设置暂时无法加载" />
          <Button type="button" variant="outline" className="w-full" onClick={() => void refetch()}>
            重试
          </Button>
        </div>
      ) : currentMode === 'register' && !settings.registrationEnabled ? (
        <div className="space-y-5">
          <Alert title="当前暂未开放注册" />
          <a
            href="/login"
            className="block text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            返回登录
          </a>
        </div>
      ) : (currentMode === 'forgot' || currentMode === 'reset') &&
        !settings.passwordResetEnabled ? (
        <div className="space-y-5">
          <Alert title="当前暂未开放密码恢复" />
          <a
            href="/login"
            className="block text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            返回登录
          </a>
        </div>
      ) : (
        <>
          {currentMode === 'login' ? <LoginForm settings={settings} nextPath={nextPath} /> : null}
          {currentMode === 'register' ? (
            <RegisterForm settings={settings} nextPath={nextPath} invitationCode={invitationCode} />
          ) : null}
          {currentMode === 'forgot' || currentMode === 'reset' ? (
            <PasswordRecoveryForm
              mode={currentMode}
              settings={settings}
              email={email}
              token={token}
            />
          ) : null}
          {children}
        </>
      )}
    </AuthLayout>
  );
}
