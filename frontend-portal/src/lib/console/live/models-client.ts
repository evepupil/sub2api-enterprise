'use client';

import { useEffect, useState } from 'react';

import { loginRedirectFor } from '@/lib/session/guard';

import type { ConsoleModelsData } from './models-types';

/**
 * 浏览器端取控制台模型页的数据（官网接口 /api/portal/console/models）。
 * 结果三种：拿到了、登录已失效（整页跳登录页）、出错（太频繁或服务暂时不可用）。
 */
export type ModelsFetchResult =
  | { kind: 'ok'; data: ConsoleModelsData }
  | { kind: 'signed_out' }
  | { kind: 'error'; reason: 'too_many' | 'unavailable' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export async function fetchConsoleModels(signal?: AbortSignal): Promise<ModelsFetchResult> {
  try {
    const response = await fetch('/api/portal/console/models', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
    if (response.status === 401) return { kind: 'signed_out' };
    if (response.status === 429) return { kind: 'error', reason: 'too_many' };
    const body: unknown = await response.json().catch(() => null);
    // 官网服务器已经整理成固定形状，这里只确认关键字段在
    if (response.ok && isRecord(body) && body.ok === true && Array.isArray(body.channels)) {
      return {
        kind: 'ok',
        data: { channels: body.channels as ConsoleModelsData['channels'] },
      };
    }
    return { kind: 'error', reason: 'unavailable' };
  } catch {
    return { kind: 'error', reason: 'unavailable' };
  }
}

export interface ConsoleModelsState {
  data: ConsoleModelsData | null;
  loading: boolean;
  error: 'too_many' | 'unavailable' | null;
}

/** 打开页面取一次；reloadKey 变了（点了重试）再取。登录失效时整页跳登录页 */
export function useConsoleModels(reloadKey: number): ConsoleModelsState {
  const [settled, setSettled] = useState<{ key: number; result: ModelsFetchResult } | null>(null);
  const [lastOk, setLastOk] = useState<ConsoleModelsData | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchConsoleModels(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.kind === 'signed_out') {
        window.location.replace(loginRedirectFor(window.location.pathname, window.location.search));
        return;
      }
      if (result.kind === 'ok') setLastOk(result.data);
      setSettled({ key: reloadKey, result });
    });
    return () => controller.abort();
  }, [reloadKey]);

  const current = settled !== null && settled.key === reloadKey ? settled.result : null;
  return {
    data: lastOk,
    loading: current === null,
    error: current?.kind === 'error' ? current.reason : null,
  };
}
