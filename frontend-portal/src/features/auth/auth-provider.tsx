'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { ApiError } from './api-error';
import { createSessionManager } from './session-manager';
import type { ApiRequester, AuthOperations, LoginChallenge, SessionSnapshot } from './types';

export interface AuthContextValue extends SessionSnapshot, AuthOperations {
  request: ApiRequester;
  acceptLogin(value: unknown): Promise<void>;
  getIdentityKey(): string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseChallenge(value: unknown): LoginChallenge | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('requires_2fa' in value) ||
    value.requires_2fa !== true
  )
    return null;
  if (!('temp_token' in value) || typeof value.temp_token !== 'string' || !value.temp_token)
    throw new Error('登录验证信息不完整，请重新登录');
  return {
    requires2fa: true,
    tempToken: value.temp_token,
    maskedEmail:
      'user_email_masked' in value && typeof value.user_email_masked === 'string'
        ? value.user_email_masked
        : '',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [manager] = useState(() => createSessionManager());
  const snapshot = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getServerSnapshot,
  );
  const queryClient = useQueryClient();
  const attempt = useRef(0);

  useEffect(() => {
    void manager.start().catch(() => {
      /* The session snapshot holds the recoverable error. */
    });
    return () => {
      attempt.current += 1;
      manager.dispose();
    };
  }, [manager]);

  useEffect(() => {
    // Remove only former identities: a new page may already have begun its own query.
    const stale = {
      predicate: (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[0] === 'portal' && query.queryKey[1] !== snapshot.identityKey,
    };
    void queryClient.cancelQueries(stale);
    queryClient.removeQueries(stale);
  }, [snapshot.identityKey, queryClient]);

  const operations = useMemo(() => {
    async function authenticate(path: string, body: unknown): Promise<LoginChallenge | null> {
      const revision = ++attempt.current;
      const identity = manager.getSnapshot().identityKey;
      const result = await manager.request(path, { method: 'POST', body, auth: false });
      if (revision !== attempt.current || identity !== manager.getSnapshot().identityKey)
        throw new ApiError(409, 'SESSION_CHANGED', '账号已变更，请重新操作');
      const challenge = parseChallenge(result);
      if (challenge) return challenge;
      await manager.acceptLogin(result);
      return null;
    }
    return {
      request: manager.request,
      getIdentityKey: () => manager.getSnapshot().identityKey,
      login: (input: Parameters<AuthOperations['login']>[0]) => authenticate('/auth/login', input),
      completeTwoFactor: async (tempToken: string, code: string) => {
        await authenticate('/auth/login/2fa', { temp_token: tempToken, totp_code: code });
      },
      register: async (input: Record<string, unknown>) => {
        await authenticate('/auth/register', input);
      },
      logout: async () => {
        attempt.current += 1;
        await manager.logout();
      },
      refreshUser: manager.refreshUser,
      acceptLogin: async (value: unknown) => {
        attempt.current += 1;
        await manager.acceptLogin(value);
      },
    };
  }, [manager]);

  return (
    <AuthContext.Provider value={{ ...snapshot, ...operations }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('账号页面缺少会话容器');
  return context;
}
