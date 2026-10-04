'use client';

import { useEffect, useState } from 'react';

import { loginRedirectFor } from '@/lib/session/guard';

import { fetchBalanceSummary, fetchLedger, type BillingFetchResult } from './billing-client';
import type { BalanceSummary, LedgerPage, LedgerQuery } from './billing-types';
import { ledgerQueryKey } from './billing-view';

export interface BillingLiveState<T> {
  /** 最近一次拿到的数据；重新取时先留着旧的，新的到了再换，页面不闪成空白 */
  data: T | null;
  /** 当前要的数据还没拿到结果 */
  loading: boolean;
  /** 当前这次出错的原因；没出错是 null */
  error: 'too_many' | 'unavailable' | null;
}

/** 登录失效时整页跳到登录页，并带上回跳地址 */
function goLogin() {
  window.location.replace(loginRedirectFor(window.location.pathname, window.location.search));
}

/** 余额卡。reloadKey 变了（兑换成功、刷新）就重新取，旧请求作废 */
export function useBalanceSummary(reloadKey: number): BillingLiveState<BalanceSummary> {
  const key = String(reloadKey);
  const [settled, setSettled] = useState<{
    key: string;
    result: BillingFetchResult<BalanceSummary>;
  } | null>(null);
  const [lastOk, setLastOk] = useState<BalanceSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchBalanceSummary(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.kind === 'signed_out') return goLogin();
      if (result.kind === 'ok') setLastOk(result.data);
      setSettled({ key, result });
    });
    return () => controller.abort();
  }, [key]);

  const current = settled !== null && settled.key === key ? settled.result : null;
  return {
    data: lastOk,
    loading: current === null,
    error: current?.kind === 'error' ? current.reason : null,
  };
}

/**
 * 一页交易记录。query 由页面用 useMemo 算好（内容不变时同一个对象）；为 null 时不取（还不知道今天是哪天）。
 * 筛选、翻页或 reloadKey 变了就重新取，旧请求作废。
 */
export function useBalanceLedger(
  query: LedgerQuery | null,
  reloadKey: number,
): BillingLiveState<LedgerPage> {
  const key = query === null ? null : `${ledgerQueryKey(query)}|${reloadKey}`;
  const [settled, setSettled] = useState<{
    key: string;
    result: BillingFetchResult<LedgerPage>;
  } | null>(null);
  const [lastOk, setLastOk] = useState<LedgerPage | null>(null);

  useEffect(() => {
    if (query === null || key === null) return;
    const controller = new AbortController();
    void fetchLedger(query, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.kind === 'signed_out') return goLogin();
      if (result.kind === 'ok') setLastOk(result.data);
      setSettled({ key, result });
    });
    return () => controller.abort();
  }, [query, key]);

  const current = settled !== null && settled.key === key ? settled.result : null;
  return {
    data: lastOk,
    loading: key !== null && current === null,
    error: current?.kind === 'error' ? current.reason : null,
  };
}
