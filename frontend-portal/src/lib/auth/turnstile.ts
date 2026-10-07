/**
 * Cloudflare Turnstile（人机验证）的浏览器脚本：只在要用时加载一次，按需渲染验证框。
 * 文档：https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 */

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  language?: string;
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** 验证框的语言跟着页面：中文页用简体中文，其余英文 */
export function turnstileLanguage(locale: string): string {
  return locale === 'zh' ? 'zh-cn' : 'en';
}

let loading: Promise<TurnstileApi> | null = null;

/** 加载 Cloudflare 的脚本（整页只加载一次）；加载失败时下次调用会重试 */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('turnstile unavailable'));
    };
    script.onerror = () => {
      script.remove();
      loading = null;
      reject(new Error('turnstile script failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
