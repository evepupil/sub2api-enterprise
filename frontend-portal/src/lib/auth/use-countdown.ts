'use client';

import { useEffect, useState } from 'react';

/**
 * 重发前的倒计时（注册发验证码、找回密码发重置链接共用）：start(n) 从 n 秒开始，每秒减一，到 0 停。
 */
export function useCountdown(): { seconds: number; start: (seconds: number) => void } {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => Math.max(value - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return { seconds, start: setSeconds };
}
