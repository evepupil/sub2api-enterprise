'use client';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * 复制到剪贴板：copy(text, key) 成功后 copiedKey 变成这个 key，1.5 秒后清空。
 * 剪贴板不可用（非安全上下文）或写入失败时静默。
 */
export function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopiedKey(key);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopiedKey(null), 1500);
      })
      .catch(() => {});
  }, []);

  return { copiedKey, copy };
}

/** 复制图标按钮：复制成功后短暂换成对勾 */
export function CopyButton({
  value,
  label,
  name,
  className,
}: {
  value: string;
  /** 读屏文字，如「复制密钥」 */
  label?: string;
  name?: string;
  className?: string;
}) {
  const t = useTranslations('console');
  const { copiedKey, copy } = useCopy();
  const copied = copiedKey === 'value';
  return (
    <button
      type="button"
      data-copy={name}
      aria-label={copied ? t('actions.copied') : (label ?? t('actions.copy'))}
      onClick={() => copy(value, 'value')}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {copied ? (
        <Check aria-hidden className="size-4 text-success" />
      ) : (
        <Copy aria-hidden className="size-4" />
      )}
    </button>
  );
}
