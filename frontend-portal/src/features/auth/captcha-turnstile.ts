'use client';

/**
 * Cloudflare Turnstile 官方脚本的单例加载器（只声明用到的官方接口）。
 *
 * 事实来源：Cloudflare Turnstile 客户端渲染文档（explicit rendering）。
 * - 脚本地址固定为 `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`，
 *   `render=explicit` 表示由我们调用 `turnstile.render(container, options)`，
 *   脚本不会自动查找 `.cf-turnstile` 节点。
 * - `render` 返回 widgetId，`reset`/`remove` 都需要它。
 * - 本模块不读取任何业务配置，也不发送后端请求。
 *
 * 只做脚本加载，不做任何挑战破解或自动应答。
 */

export interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  'timeout-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  language?: string;
  action?: string;
}

export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
  getResponse(widgetId?: string): string | undefined;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** 官方显式渲染脚本地址。 */
export const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let loader: Promise<TurnstileApi> | null = null;

/**
 * 加载 Turnstile 脚本并返回全局 API。
 *
 * - 模块级单例：同一页面只会注入一个 script 标签。
 * - 已在页面上存在 `window.turnstile`（例如其他入口已加载）时直接复用。
 * - 失败后清除缓存，允许调用方重试。
 */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile 只能在浏览器中加载'));
  }
  const existing = window.turnstile;
  if (existing !== undefined) {
    return Promise.resolve(existing);
  }
  if (loader !== null) {
    return loader;
  }

  const pending = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const api = window.turnstile;
      if (api !== undefined) {
        resolve(api);
        return;
      }
      reject(new Error('Turnstile 脚本已加载但接口未就绪'));
    };
    script.onerror = () => {
      reject(new Error('Turnstile 脚本加载失败'));
    };
    document.head.appendChild(script);
  });

  loader = pending;
  void pending.catch(() => {
    if (loader === pending) {
      loader = null;
    }
  });
  return pending;
}
