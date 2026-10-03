'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * 延迟执行：模拟提交、刷新要等一会儿才有结果。同一时刻只保留最后一次，
 * 组件卸载（比如弹窗被关掉）时清掉还没触发的定时器，不会对已卸载的组件改状态。
 */
export function useDelayedRun() {
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return useCallback((run: () => void, ms: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      run();
    }, ms);
  }, []);
}
