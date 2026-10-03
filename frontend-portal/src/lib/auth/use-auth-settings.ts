'use client';

import { useEffect, useState } from 'react';

import { fetchAuthSettings } from './register-client';
import { DEFAULT_AUTH_SETTINGS, type AuthSettings } from './settings';

/**
 * 打开注册页时读一次后端公开开关。读取期间表单不可提交（和现有注册页一致）；
 * 读不到时用兜底值，真正的限制仍由后端在提交时把关。
 */
export function useAuthSettings(): { loaded: boolean; settings: AuthSettings } {
  const [state, setState] = useState<{ loaded: boolean; settings: AuthSettings }>({
    loaded: false,
    settings: DEFAULT_AUTH_SETTINGS,
  });

  useEffect(() => {
    let cancelled = false;
    void fetchAuthSettings().then((settings) => {
      if (!cancelled) setState({ loaded: true, settings: settings ?? DEFAULT_AUTH_SETTINGS });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
