'use client';

import { useMemo, useSyncExternalStore } from 'react';

import { liveClockSnapshot, parseLiveClock, type LiveClock } from '../time';

/** 每分钟看一次时间，跨小时、跨天时页面跟着更新 */
function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

const serverSnapshot = (): string | null => null;

/**
 * 真实的今天与当前小时（北京时间）。控制台页面是预先生成的静态页，服务端渲染和首次水合时这里是 null，
 * 挂载后才读浏览器时间，避免两边算出的日期对不上。
 */
export function useLiveClock(): LiveClock | null {
  const snapshot = useSyncExternalStore<string | null>(
    subscribe,
    liveClockSnapshot,
    serverSnapshot,
  );
  return useMemo(() => (snapshot === null ? null : parseLiveClock(snapshot)), [snapshot]);
}
