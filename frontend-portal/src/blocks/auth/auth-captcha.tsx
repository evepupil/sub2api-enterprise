'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

import { loadTurnstile, turnstileLanguage } from '@/lib/auth/turnstile';
import type { CaptchaState } from '@/lib/auth/use-captcha';

/**
 * 人机验证框（Cloudflare Turnstile）：后台开了才渲染，宽度撑满表单。
 * 通过后把结果交给 captcha.setToken；过期或出错时清空，Cloudflare 会自己重新验证。
 * captcha.resetKey 变化（结果已提交用掉）时重新验证；主题跟着页面的明暗切换，语言跟着页面语言。
 */
export function AuthCaptcha({ captcha }: { captcha: CaptchaState }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const { siteKey, setToken, resetKey } = captcha;
  // 明暗主题在页面挂载后才知道；知道之前不渲染，免得先按默认主题渲染一次又马上重来
  const theme = resolvedTheme === 'dark' ? 'dark' : resolvedTheme === 'light' ? 'light' : null;

  useEffect(() => {
    if (siteKey === '' || theme === null) return;
    let cancelled = false;
    loadTurnstile().then(
      (api) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        widgetRef.current =
          api.render(container, {
            sitekey: siteKey,
            theme,
            size: 'flexible',
            language: turnstileLanguage(locale),
            callback: (token) => setToken(token),
            'expired-callback': () => setToken(''),
            'error-callback': () => setToken(''),
          }) ?? null;
        setStatus('ready');
      },
      () => {
        if (!cancelled) setStatus('failed');
      },
    );
    return () => {
      cancelled = true;
      if (widgetRef.current !== null) window.turnstile?.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [siteKey, theme, locale, setToken]);

  useEffect(() => {
    if (resetKey === 0 || widgetRef.current === null) return;
    window.turnstile?.reset(widgetRef.current);
  }, [resetKey]);

  if (siteKey === '') return null;
  if (status === 'failed') {
    return (
      <p role="alert" data-captcha="failed" className="text-sm text-danger">
        {t('captcha.loadFailed')}
      </p>
    );
  }
  return (
    // 验证框高度固定 65px，加载时先占住，下面的按钮不跳动
    <div data-captcha={status} className="relative min-h-[65px]">
      <div ref={containerRef} />
      {status === 'loading' ? (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground"
        >
          {t('captcha.loading')}
        </p>
      ) : null}
    </div>
  );
}
