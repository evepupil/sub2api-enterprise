'use client';

import { useEffect, useState } from 'react';

import { loginRedirectFor } from '@/lib/session/guard';

import { fetchUsageOverview, type UsageFetchResult } from './usage-client';
import type { UsageOverview } from './usage-types';

export interface UsageOverviewState {
  /** 最近一次拿到的数据；换范围时先留着旧的，新的到了再换，页面不闪成空白 */
  overview: UsageOverview | null;
  /** 当前要的范围还没拿到结果 */
  loading: boolean;
  /** 当前范围出错的原因；没出错是 null */
  error: 'too_many' | 'unavailable' | null;
}

/**
 * 按范围取用量数据。范围、明细开关或 reloadKey（刷新按钮）变了就重新取，旧请求作废；
 * 登录失效时整页跳到登录页并带上回跳地址。from、to 为 null 时不取（还不知道今天是哪天）。
 */
export function useUsageOverview(
  from: string | null,
  to: string | null,
  detail: boolean,
  reloadKey: number,
): UsageOverviewState {
  const key = from !== null && to !== null ? `${from}|${to}|${detail ? 1 : 0}|${reloadKey}` : null;
  const [settled, setSettled] = useState<{ key: string; result: UsageFetchResult } | null>(null);
  const [lastOk, setLastOk] = useState<UsageOverview | null>(null);

  useEffect(() => {
    if (from === null || to === null || key === null) return;
    const controller = new AbortController();
    void fetchUsageOverview({ from, to, detail }, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.kind === 'signed_out') {
        window.location.replace(loginRedirectFor(window.location.pathname, window.location.search));
        return;
      }
      if (result.kind === 'ok') setLastOk(result.overview);
      setSettled({ key, result });
    });
    return () => controller.abort();
  }, [from, to, detail, key]);

  const current = settled !== null && settled.key === key ? settled.result : null;
  return {
    overview: lastOk,
    loading: key !== null && current === null,
    error: current?.kind === 'error' ? current.reason : null,
  };
}
