'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchCurrentUser, signOut } from './client';
import { loginRedirectFor } from './guard';
import type { SessionUser } from './types';

/**
 * 控制台里的登录状态：打开控制台时读一次当前用户，供头像菜单等处显示；提供「退出登录」。
 * 读当前用户时发现登录已失效（官网接口返回 401），直接整页跳到登录页并带上回跳地址。
 * 后端暂时连不上时保持「加载中」不跳转，避免把用户踢出去。
 */
export interface SessionState {
  status: 'loading' | 'authenticated' | 'unavailable';
  user: SessionUser | null;
  /** 退出登录：通知后端作废凭证、清掉 cookie，然后整页回到登录页 */
  signOut: () => Promise<void>;
  /** 本页改了用户资料（如账户设置里改用户名）后，把新值合进当前用户，头像菜单等处立刻跟着变 */
  updateUser: (patch: Partial<Pick<SessionUser, 'username'>>) => void;
}

const SessionContext = createContext<SessionState | null>(null);

function goToLogin() {
  const { pathname, search } = window.location;
  window.location.replace(loginRedirectFor(pathname, search));
}

/** 回登录页（不带回跳）：退出登录后用，按当前语言选登录页 */
function goToLoginAfterSignOut() {
  const english = window.location.pathname === '/en' || window.location.pathname.startsWith('/en/');
  window.location.replace(english ? '/en/login' : '/login');
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchCurrentUser().then((result) => {
      if (cancelled) return;
      if (result.kind === 'user') {
        setUser(result.user);
        setStatus('authenticated');
      } else if (result.kind === 'signed_out') {
        goToLogin();
      } else {
        setStatus('unavailable');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    goToLoginAfterSignOut();
  }, []);

  const updateUser = useCallback((patch: Partial<Pick<SessionUser, 'username'>>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo<SessionState>(
    () => ({ status, user, signOut: handleSignOut, updateUser }),
    [status, user, handleSignOut, updateUser],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** 读控制台的登录状态；必须在 SessionProvider 里面用 */
export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
