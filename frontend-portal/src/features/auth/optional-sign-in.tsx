'use client';

import { useState, useSyncExternalStore } from 'react';
import { ExternalLink, Fingerprint } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { isPasskeySupported, loginWithPasskey } from './passkey';
import { useAuth } from './auth-provider';
import {
  acceptOAuthLogin,
  errorMessage,
  OAUTH_NEXT_STORAGE_KEY,
  OAUTH_PROVIDER_STORAGE_KEY,
  safeReturnPath,
} from './oauth-utils';
import type { AuthSettings, CaptchaProof } from './types';

export interface OptionalSignInProps {
  settings: AuthSettings;
  proof?: CaptchaProof;
  nextPath?: string;
  onError?: (message: string) => void;
}

function validProviderId(value: string): boolean {
  return /^[a-z0-9_-]{1,64}$/iu.test(value);
}

export function OptionalSignIn({ settings, proof, nextPath, onError }: OptionalSignInProps) {
  const auth = useAuth();
  const supported = useSyncExternalStore(
    () => () => undefined,
    isPasskeySupported,
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const providers = settings.oauthProviders.filter(
    (provider, index, all) =>
      validProviderId(provider.id) && all.findIndex((item) => item.id === provider.id) === index,
  );

  if (providers.length === 0 && !(settings.passkeyEnabled && supported)) return null;

  const reportError = (error: unknown): void => {
    const message = errorMessage(error, '无法完成登录，请稍后重试');
    setLocalError(message);
    onError?.(message);
  };

  const destination = (): string => safeReturnPath(nextPath, '/console');

  const startOAuth = async (providerId: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setLocalError('');
    const expectedIdentityKey = auth.getIdentityKey();
    const next = destination();
    try {
      window.sessionStorage.setItem(OAUTH_NEXT_STORAGE_KEY, next);
      window.sessionStorage.setItem(OAUTH_PROVIDER_STORAGE_KEY, providerId);
      const response = await auth.request<unknown>(`/auth/oauth/${providerId}/start`, {
        method: 'POST',
        auth: false,
        body: proof ?? {},
      });
      if (auth.getIdentityKey() !== expectedIdentityKey) {
        throw new Error('当前登录身份已变化，已取消第三方登录');
      }
      if (
        typeof response !== 'object' ||
        response === null ||
        !('authorize_url' in response) ||
        typeof response.authorize_url !== 'string'
      ) {
        throw new Error('第三方登录初始化响应缺少授权地址');
      }
      let authorizeUrl: URL;
      try {
        authorizeUrl = new URL(response.authorize_url);
      } catch {
        throw new Error('第三方登录授权地址无效');
      }
      if (
        (authorizeUrl.protocol !== 'http:' && authorizeUrl.protocol !== 'https:') ||
        authorizeUrl.username !== '' ||
        authorizeUrl.password !== '' ||
        authorizeUrl.hostname === ''
      ) {
        throw new Error('第三方登录授权地址不安全');
      }
      window.location.assign(authorizeUrl.href);
    } catch (error: unknown) {
      try {
        window.sessionStorage.removeItem(OAUTH_NEXT_STORAGE_KEY);
        window.sessionStorage.removeItem(OAUTH_PROVIDER_STORAGE_KEY);
      } catch {
        // Storage may be disabled; the login error remains visible.
      }
      reportError(error);
      setBusy(false);
    }
  };

  const startPasskey = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setLocalError('');
    const expectedIdentityKey = auth.getIdentityKey();
    try {
      const response = await loginWithPasskey(auth.request, proof);
      await acceptOAuthLogin(
        auth.request,
        auth.acceptLogin,
        response,
        expectedIdentityKey,
        auth.getIdentityKey,
      );
      window.location.assign(destination());
    } catch (error: unknown) {
      reportError(error);
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3" aria-label="其他登录方式">
      {providers.map((provider) => (
        <Button
          key={provider.id}
          className="w-full"
          variant="outline"
          disabled={busy}
          loading={busy}
          onClick={() => void startOAuth(provider.id)}
        >
          <ExternalLink aria-hidden="true" />
          {provider.label || provider.id}
        </Button>
      ))}
      {settings.passkeyEnabled && supported ? (
        <Button
          className="w-full"
          variant="outline"
          disabled={busy}
          loading={busy}
          onClick={() => void startPasskey()}
        >
          <Fingerprint aria-hidden="true" />
          使用通行密钥登录
        </Button>
      ) : null}
      {localError ? (
        <p className="text-sm text-destructive" role="alert">
          {localError}
        </p>
      ) : null}
    </section>
  );
}
