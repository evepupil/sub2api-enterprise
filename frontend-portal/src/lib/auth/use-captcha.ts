'use client';

import { useCallback, useState } from 'react';

/** 一个页面上的人机验证状态：验证框把结果交给这里，提交时取用，用过就作废重验 */
export interface CaptchaState {
  /** 后台开了 Cloudflare 人机验证时的站点公钥；'' 表示不用验证 */
  siteKey: string;
  enabled: boolean;
  /** 当前可用的验证结果；还没通过或已过期时为 '' */
  token: string;
  /** 要验证却还没拿到结果：提交按钮不可点 */
  missing: boolean;
  /** 每次作废结果时加一，验证框据此重新验证 */
  resetKey: number;
  setToken: (token: string) => void;
  /** 验证结果只能用一次：每次提交给后台后（不论成败）调用，验证框会自动重新验证 */
  reset: () => void;
}

export function useCaptcha(siteKey: string): CaptchaState {
  const [token, setToken] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const reset = useCallback(() => {
    setToken('');
    setResetKey((current) => current + 1);
  }, []);
  const enabled = siteKey !== '';
  return {
    siteKey,
    enabled,
    token,
    missing: enabled && token === '',
    resetKey,
    setToken,
    reset,
  };
}
