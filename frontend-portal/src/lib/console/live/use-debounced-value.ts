'use client';

import { useEffect, useState } from 'react';

/** 输入停下 delay 毫秒后才更新的值（搜索框边打字边查时，避免每个字都问一次后端） */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
