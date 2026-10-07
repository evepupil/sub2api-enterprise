'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 延时执行（如密码改好后过一会儿跳登录页）。返回一个「过多久之后做什么」的函数，
 * 所有还没到点的定时器在组件卸载时一起清掉，页面离开后不会再去改状态。
 */
export function useSchedule() {
  const pending = useRef(new Set<number>());

  useEffect(() => {
    const timers = pending.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
  }, []);

  return useCallback((run: () => void, delayMs: number) => {
    const id = window.setTimeout(() => {
      pending.current.delete(id);
      run();
    }, delayMs);
    pending.current.add(id);
  }, []);
}

/**
 * 短暂显示的结果提示（「已保存」）：show() 之后显示一段时间自动消失，
 * 期间再次触发会重新计时；卸载时清掉定时器。
 */
export function useFlash(durationMs: number) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const show = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setVisible(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setVisible(false);
    }, durationMs);
  }, [durationMs]);

  return { visible, show };
}
