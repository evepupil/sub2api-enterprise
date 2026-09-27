'use client';

import { CaptchaChallenge } from './captcha-challenge';
import type { OAuthCallbackState } from './use-oauth-callback';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function OAuthRegistrationForms({ state }: { state: OAuthCallbackState }) {
  const {
    mode,
    busy,
    settings,
    email,
    password,
    confirmPassword,
    verifyCode,
    verifySent,
    verifyCountdown,
    invitationCode,
    bindEmail,
    bindPassword,
    captchaResetKey,
    agreed,
    agreementOpen,
    registrationNeedsEmailCode,
    setMode,
    setEmail,
    setPassword,
    setConfirmPassword,
    setVerifyCode,
    setInvitationCode,
    setBindEmail,
    setBindPassword,
    setProof,
    setAgreed,
    setAgreementOpen,
    submitCreateAccount,
    submitBindLogin,
    sendVerifyCode,
    bindAllowed,
  } = state;

  return (
    <>
      {mode === 'create-account' || mode === 'email-completion' ? (
        <form className="space-y-3" onSubmit={(event) => void submitCreateAccount(event)}>
          <Input
            type="email"
            aria-label="邮箱"
            autoComplete="email"
            placeholder="邮箱"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={busy}
          />
          {mode === 'email-completion' ? (
            <p className="text-xs text-muted-foreground">请补充邮箱地址以继续登录。</p>
          ) : null}
          <Input
            type="password"
            aria-label="密码"
            autoComplete="new-password"
            placeholder="密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={busy}
          />
          <Input
            type="password"
            aria-label="确认密码"
            autoComplete="new-password"
            placeholder="确认密码"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            disabled={busy}
          />
          {registrationNeedsEmailCode ? (
            <div className="flex gap-2">
              <Input
                aria-label="邮箱验证码"
                inputMode="numeric"
                placeholder="邮箱验证码"
                value={verifyCode}
                onChange={(event) => setVerifyCode(event.target.value)}
                disabled={busy}
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy || verifyCountdown > 0}
                onClick={() => void sendVerifyCode()}
              >
                {verifyCountdown > 0
                  ? `${verifyCountdown}秒后重试`
                  : verifySent
                    ? '重新发送'
                    : '发送验证码'}
              </Button>
            </div>
          ) : null}
          {settings !== undefined ? (
            <CaptchaChallenge
              settings={settings}
              resetKey={captchaResetKey}
              onProof={(nextProof) => setProof(nextProof ?? undefined)}
            />
          ) : null}
          <Input
            aria-label="邀请码"
            autoComplete="off"
            placeholder="邀请码（如需要）"
            value={invitationCode}
            onChange={(event) => setInvitationCode(event.target.value)}
            disabled={busy}
          />
          {settings?.agreement.enabled ? (
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-primary"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>
                我已阅读并同意
                {settings.agreement.documents.map((document, index) => (
                  <span key={document.id}>
                    {index > 0 ? '、' : ''}{' '}
                    <button
                      type="button"
                      className="underline underline-offset-4 hover:text-foreground"
                      onClick={() => setAgreementOpen(true)}
                    >
                      {document.title}
                    </button>
                  </span>
                ))}
              </span>
            </label>
          ) : null}
          <Button className="w-full" type="submit" loading={busy}>
            继续
          </Button>
          {bindAllowed ? (
            <Button
              className="w-full"
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setMode('bind-login')}
            >
              改为绑定已有账号
            </Button>
          ) : null}
        </form>
      ) : null}

      {mode === 'bind-login' ? (
        <form className="space-y-3" onSubmit={(event) => void submitBindLogin(event)}>
          <Input
            type="email"
            aria-label="已有账号邮箱"
            autoComplete="email"
            placeholder="已有账号邮箱"
            value={bindEmail}
            onChange={(event) => setBindEmail(event.target.value)}
            required
            disabled={busy}
          />
          <Input
            type="password"
            aria-label="已有账号密码"
            autoComplete="current-password"
            placeholder="已有账号密码"
            value={bindPassword}
            onChange={(event) => setBindPassword(event.target.value)}
            required
            disabled={busy}
          />
          <Button className="w-full" type="submit" loading={busy}>
            验证并继续
          </Button>
          <Button
            className="w-full"
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setMode('create-account')}
          >
            创建新账号
          </Button>
        </form>
      ) : null}

      <Dialog open={agreementOpen} onOpenChange={setAgreementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>注册协议</DialogTitle>
            <DialogDescription>请阅读协议内容后再勾选同意。</DialogDescription>
          </DialogHeader>
          {settings?.agreement.documents.map((document) => (
            <section key={document.id} className="space-y-2 text-sm leading-relaxed">
              <h2 className="font-medium">{document.title}</h2>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {document.content || '暂无正文'}
              </p>
            </section>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
