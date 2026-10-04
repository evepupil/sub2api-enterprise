'use client';

import { useEffect, useRef, useState } from 'react';

import { loginRedirectFor } from '@/lib/session/guard';

/**
 * 控制台接后端的页面共用的取数工具（日志页、密钥页）：
 * 浏览器只访问官网自己的接口（/api/portal/console/*），结果统一成三种：
 * 拿到了、登录已失效（整页跳登录页）、出错（太频繁或服务暂时不可用）。
 */
export type FetchResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'signed_out' }
  | { kind: 'error'; reason: 'too_many' | 'unavailable' };

/** 不该取数时的占位结果（条件还没准备好） */
export function unavailable<T>(): Promise<FetchResult<T>> {
  return Promise.resolve({ kind: 'error', reason: 'unavailable' });
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 读一个官网接口：返回 { ok: true, ... } 时交给 accept 挑出要的数据，挑不出来算出错 */
export async function getPortalJson<T>(
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

/** 登录失效时整页跳到登录页，登录后回到当前页 */
export function redirectToLogin(): void {
  window.location.replace(loginRedirectFor(window.location.pathname, window.location.search));
}

/** 提交类操作的结果：成功带数据，失败带原因（原因由各页面写成一句话） */
export type ActionResult<T, R extends string> = { ok: true; data: T } | { ok: false; reason: R };

/**
 * 提交一个改动到官网接口：官网接口给了认得的原因就用它，否则按状态码交给 fallback 归类；
 * 登录失效时整页跳登录页。
 */
export async function sendPortalJson<T, R extends string>(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body: unknown,
  accept: (payload: Record<string, unknown>) => T | null,
  reasons: readonly R[],
  fallback: (status: number) => R,
): Promise<ActionResult<T, R>> {
  try {
    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 401) {
      redirectToLogin();
      return { ok: false, reason: fallback(401) };
    }
    const payload: unknown = await response.json().catch(() => null);
    if (response.ok && isRecord(payload) && payload.ok === true) {
      const data = accept(payload);
      return data === null ? { ok: false, reason: fallback(502) } : { ok: true, data };
    }
    const given = isRecord(payload) && isRecord(payload.error) ? payload.error.reason : null;
    const known = reasons.find((reason) => reason === given);
    return { ok: false, reason: known ?? fallback(response.status) };
  } catch {
    return { ok: false, reason: fallback(503) };
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
        redirectToLogin();
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
