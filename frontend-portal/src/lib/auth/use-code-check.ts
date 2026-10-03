'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { IDLE, type CodeCheck } from './register-form';

/** 停止输入多久后去校验，毫秒（和现有注册页一致） */
export const CODE_CHECK_DELAY_MS = 500;

/**
 * 邀请码、优惠码的实时校验：输入时先清掉上次结果，停下 0.5 秒再去后端校验；
 * 后发起的校验覆盖先发起的，旧结果晚到也不会盖掉新结果。
 * checkNow 立即校验并返回结果，提交时邀请码还没校验过就用它。
 */
export function useCodeCheck(checker: (code: string) => Promise<CodeCheck>) {
  const [check, setCheck] = useState<CodeCheck>(IDLE);
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const checkNow = useCallback(
    async (code: string): Promise<CodeCheck> => {
      clearTimer();
      const trimmed = code.trim();
      const id = ++sequence.current;
      if (trimmed === '') {
        setCheck(IDLE);
        return IDLE;
      }
      setCheck({ status: 'checking' });
      const result = await checker(trimmed);
      if (id === sequence.current) setCheck(result);
      return result;
    },
    [checker],
  );

  const onInput = useCallback(
    (code: string) => {
      clearTimer();
      sequence.current += 1;
      setCheck(IDLE);
      if (code.trim() === '') return;
      timer.current = setTimeout(() => void checkNow(code), CODE_CHECK_DELAY_MS);
    },
    [checkNow],
  );

  return { check, onInput, checkNow };
}
