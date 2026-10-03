'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { pickAllowed, readList, readParam, writeList, writeParam } from './url-state-core';

/**
 * 把一个界面状态放进网址查询参数，同页所有区块共用：
 * 一个区块改了 ?edition=pro，其他读同一参数的区块立刻跟着变，刷新和分享链接也保留。
 * 服务端与首次水合按默认值渲染，水合完成后再读真实网址，所以不需要 Suspense。
 */
const EVENT = 'url-state-change';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

const getSnapshot = () => window.location.search;
const getServerSnapshot = () => '';

function useSearch(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function replaceParam(key: string, value: string | null) {
  const next = writeParam(window.location.search, key, value);
  // 沿用 history.state，Next.js 路由才能识别这次地址变化
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${next}${window.location.hash}`,
  );
  window.dispatchEvent(new Event(EVENT));
}

/** 单选状态：取值限定在 allowed 内，等于默认值时从网址里去掉 */
export function useUrlState<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const value = pickAllowed(readParam(useSearch(), key), allowed, fallback);
  const set = useCallback(
    (next: T) => replaceParam(key, next === fallback ? null : next),
    [key, fallback],
  );
  return [value, set];
}

/** 多选状态：逗号分隔，空数组时从网址里去掉 */
export function useUrlList<T extends string>(
  key: string,
  allowed: readonly T[],
): [T[], (next: readonly T[]) => void] {
  const raw = readParam(useSearch(), key);
  const value = readList(raw, allowed);
  const set = useCallback((next: readonly T[]) => replaceParam(key, writeList(next)), [key]);
  return [value, set];
}

/** 自由文本（如搜索词），空串时从网址里去掉 */
export function useUrlText(key: string): [string, (next: string) => void] {
  const value = readParam(useSearch(), key) ?? '';
  const set = useCallback((next: string) => replaceParam(key, next), [key]);
  return [value, set];
}
