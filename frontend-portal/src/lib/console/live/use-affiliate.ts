'use client';

import { useEffect, useState } from 'react';

import { fetchAuthSettings } from '@/lib/auth/register-client';
import { loginRedirectFor } from '@/lib/session/guard';

import { fetchAffiliate, type AffiliateFetchResult } from './invite-client';
import type { AffiliateState } from './invite-types';

export interface AffiliateLiveState {
  /** 最近一次拿到的结果；重新取时先留着旧的，新的到了再换 */
  state: AffiliateState | null;
  loading: boolean;
  error: 'too_many' | 'unavailable' | null;
}

/** 邀请页的数据。reloadKey 变了（转入余额、重试）就重新取，旧请求作废；登录失效时整页跳登录页 */
export function useAffiliate(reloadKey: number): AffiliateLiveState {
  const key = String(reloadKey);
  const [settled, setSettled] = useState<{ key: string; result: AffiliateFetchResult } | null>(
    null,
  );
  const [lastOk, setLastOk] = useState<AffiliateState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAffiliate(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.kind === 'signed_out') {
        window.location.replace(loginRedirectFor(window.location.pathname, window.location.search));
        return;
      }
      if (result.kind === 'ok') setLastOk(result.state);
      setSettled({ key, result });
    });
    return () => controller.abort();
  }, [key]);

  const current = settled !== null && settled.key === key ? settled.result : null;
  return {
    state: lastOk,
    loading: current === null,
    error: current?.kind === 'error' ? current.reason : null,
  };
}

/**
 * 后台有没有开邀请返利（后端公开设置，官网服务器缓存 30 秒）。还没读到时是 null；
 * 读不到时按没开处理（和 sub2api 的默认值一致）。侧栏据此决定显不显示「邀请」。
 */
export function useAffiliateEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void fetchAuthSettings().then((settings) => {
      if (active) setEnabled(settings?.affiliateEnabled ?? false);
    });
    return () => {
      active = false;
    };
  }, []);
  return enabled;
}
