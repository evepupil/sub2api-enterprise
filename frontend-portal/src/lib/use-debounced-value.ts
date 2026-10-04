'use client';

import { useEffect, useState } from 'react';

/**
 * 停下来 delayMs 之后才跟着变的值。搜索框、金额框这类每敲一个字就会查一次后端的输入用它，
 * 免得打一个词发十几次请求、撞上后端的限流。
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
