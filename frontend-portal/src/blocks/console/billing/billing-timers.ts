'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * 页内的延时任务：占位页面里「加载 800ms 再给结果」「提示 2 秒后消失」都靠它。
 * 同一个槽位重新安排时先取消上一次，组件卸载时全部取消，避免对已卸载的组件改状态。
 */
export function useTimers() {
  const slots = useRef(new Map<string, number>());

  useEffect(() => {
    const active = slots.current;
    return () => {
      for (const id of active.values()) window.clearTimeout(id);
      active.clear();
    };
  }, []);

  const cancel = useCallback((slot: string) => {
    const id = slots.current.get(slot);
    if (id === undefined) return;
    window.clearTimeout(id);
    slots.current.delete(slot);
  }, []);

  const schedule = useCallback((slot: string, delayMs: number, task: () => void) => {
    const active = slots.current;
    const previous = active.get(slot);
    if (previous !== undefined) window.clearTimeout(previous);
    active.set(
      slot,
      window.setTimeout(() => {
        active.delete(slot);
        task();
      }, delayMs),
    );
  }, []);

  return { schedule, cancel };
}
