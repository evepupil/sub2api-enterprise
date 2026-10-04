'use client';

import { useEffect, useRef, useState } from 'react';

import { loginRedirectFor } from '@/lib/session/guard';

import type { LogFilters, LogOptions, LogQuery, LogsPageData } from './logs-types';

/**
 * 浏览器端取日志页的数据（官网接口 /api/portal/console/logs*）。
 * 结果统一成三种：拿到了、登录已失效（整页跳登录页）、出错（太频繁或服务暂时不可用）。
 */
export type FetchResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'signed_out' }
  | { kind: 'error'; reason: 'too_many' | 'unavailable' };

/** 不该取数时的占位结果（条件还没准备好） */
export function unavailable<T>(): Promise<FetchResult<T>> {
  return Promise.resolve({ kind: 'error', reason: 'unavailable' });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 筛选条件 → 官网接口的查询参数 */
export function filterParams(filters: LogFilters): URLSearchParams {
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.keyId !== null) params.set('key', String(filters.keyId));
  if (filters.model !== null) params.set('model', filters.model);
  if (filters.type !== 'all') params.set('type', filters.type);
  if (filters.stream !== 'all') params.set('stream', filters.stream);
  return params;
}

async function getJson<T>(
  url: string,
  accept: (body: Record<string, unknown>) => T | null,
  signal?: AbortSignal,
): Promise<FetchResult<T>> {
  try {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal });
    if (response.status === 401) return { kind: 'signed_out' };
    if (response.status === 429) return { kind: 'error', reason: 'too_many' };
    const body: unknown = await response.json().catch(() => null);
    const data = response.ok && isRecord(body) && body.ok === true ? accept(body) : null;
    return data ? { kind: 'ok', data } : { kind: 'error', reason: 'unavailable' };
  } catch {
    return { kind: 'error', reason: 'unavailable' };
  }
}

/** 一页日志 */
export function fetchLogs(
  query: LogQuery,
  signal?: AbortSignal,
): Promise<FetchResult<LogsPageData>> {
  const params = filterParams(query);
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return getJson(
    `/api/portal/console/logs?${params.toString()}`,
    (body) =>
      Array.isArray(body.items) && typeof body.total === 'number'
        ? {
            items: body.items as LogsPageData['items'],
            total: body.total,
            page: typeof body.page === 'number' ? body.page : query.page,
            pageSize: typeof body.pageSize === 'number' ? body.pageSize : query.pageSize,
          }
        : null,
    signal,
  );
}

/** 筛选下拉的选项（密钥、这段时间用过的模型） */
export function fetchLogOptions(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<FetchResult<LogOptions>> {
  return getJson(
    `/api/portal/console/logs/options?${new URLSearchParams({ from, to }).toString()}`,
    (body) =>
      Array.isArray(body.keys) && Array.isArray(body.models)
        ? { keys: body.keys as LogOptions['keys'], models: body.models as string[] }
        : null,
    signal,
  );
}

/** 导出 CSV：官网服务器拼好文件，这里存成下载。成功返回 true；登录失效时跳登录页 */
export async function downloadLogsCsv(filters: LogFilters, locale: string): Promise<boolean> {
  const params = filterParams(filters);
  params.set('locale', locale);
  try {
    const response = await fetch(`/api/portal/console/logs/export?${params.toString()}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (response.status === 401) {
      window.location.replace(loginRedirectFor(window.location.pathname, window.location.search));
      return false;
    }
    if (!response.ok) return false;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-${filters.from}-${filters.to}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    // 下载已经交给浏览器，稍等再释放临时地址，个别浏览器点击后立刻释放会丢掉下载
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

export interface Loadable<T> {
  /** 最近一次拿到的数据；换条件时先留着旧的 */
  data: T | null;
  loading: boolean;
  error: 'too_many' | 'unavailable' | null;
}

/**
 * 按 key 取数：key 变了（条件或 reloadKey 变了）就重新取，旧请求作废；key 为 null 时不取。
 * 登录失效时整页跳登录页。
 */
export function useLoadable<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<FetchResult<T>>,
): Loadable<T> {
  const [settled, setSettled] = useState<{ key: string; result: FetchResult<T> } | null>(null);
  const [lastOk, setLastOk] = useState<T | null>(null);
  // load 每次渲染都是新函数：存起来用最新的，只按 key 决定要不要重取
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    void loadRef.current(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.kind === 'signed_out') {
        window.location.replace(loginRedirectFor(window.location.pathname, window.location.search));
        return;
      }
      if (result.kind === 'ok') setLastOk(result.data);
      setSettled({ key, result });
    });
    return () => controller.abort();
  }, [key]);

  const current = settled !== null && settled.key === key ? settled.result : null;
  return {
    data: lastOk,
    loading: key !== null && current === null,
    error: current?.kind === 'error' ? current.reason : null,
  };
}
