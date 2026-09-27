'use client';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OAuthRegistrationForms } from './oauth-registration-form';
import { useOAuthCallback } from './use-oauth-callback';

export function OAuthCallback() {
  const state = useOAuthCallback();
  const {
    mode,
    busy,
    message,
    settingsError,
    suggestedName,
    suggestedAvatar,
    adoptName,
    adoptAvatar,
    totpCode,
    setAdoptName,
    setAdoptAvatar,
    setTotpCode,
    submitAdoption,
    submitTotp,
    setMode,
  } = state;
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-foreground">第三方登录</h1>
          <p
            className="text-sm text-muted-foreground"
            role={mode === 'error' ? 'alert' : undefined}
          >
            {message}
          </p>
        </div>

        {settingsError ? (
          <Alert variant="destructive" title="认证设置暂时无法加载，请稍后重试。" />
        ) : null}

        {mode === 'processing' ? (
          <div className="h-1 w-full overflow-hidden rounded bg-muted" aria-label="处理中">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
        ) : null}

        {mode === 'choose' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {state.bindAllowed ? (
              <Button variant="outline" disabled={busy} onClick={() => setMode('bind-login')}>
                绑定已有账号
              </Button>
            ) : null}
            {state.createAllowed ? (
              <Button disabled={busy} onClick={() => setMode('create-account')}>
                创建新账号
              </Button>
            ) : null}
          </div>
        ) : null}

        <OAuthRegistrationForms state={state} />

        {mode === 'adoption' ? (
          <div className="space-y-3">
            {suggestedName ? (
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={adoptName}
                  onChange={(event) => setAdoptName(event.target.checked)}
                />
                使用显示名称：{suggestedName}
              </label>
            ) : null}
            {suggestedAvatar ? (
              <label className="flex items-center gap-3 break-all text-sm">
                <input
                  type="checkbox"
                  checked={adoptAvatar}
                  onChange={(event) => setAdoptAvatar(event.target.checked)}
                />
                使用头像：{suggestedAvatar}
              </label>
            ) : null}
            <Button className="w-full" loading={busy} onClick={() => void submitAdoption()}>
              确认并继续
            </Button>
          </div>
        ) : null}

        {mode === 'totp' ? (
          <form className="space-y-3" onSubmit={(event) => void submitTotp(event)}>
            <Input
              inputMode="numeric"
              aria-label="6位验证码"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6 位验证码"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              required
              disabled={busy}
            />
            <Button
              className="w-full"
              type="submit"
              loading={busy}
              disabled={busy || totpCode.trim().length !== 6}
            >
              验证并登录
            </Button>
          </form>
        ) : null}

        {mode === 'completed' ? (
          <Button className="w-full" onClick={() => state.navigate()}>
            返回
          </Button>
        ) : null}
        {mode === 'error' ? (
          <Button className="w-full" variant="outline" onClick={() => state.navigate('/login')}>
            返回登录
          </Button>
        ) : null}
      </section>
    </main>
  );
}
