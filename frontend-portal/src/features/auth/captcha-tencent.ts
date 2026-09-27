'use client';

/**
 * 腾讯天御验证码官方脚本的单例加载器。
 *
 * 事实来源：旧前端 `frontend/src/utils/tencentCaptcha.ts`（中国站分支）与
 * 任务书给定的脚本地址 `https://turing.captcha.qcloud.com/TCaptcha.js`。
 *
 * - 全局构造函数 `window.TencentCaptcha`，用法 `new TencentCaptcha(appId, callback, options)`，
 *   实例提供 `show()`；用户关闭弹窗时回调 `ret === 2`，成功时 `ret === 0`
 *   并带 `ticket` + `randstr`。
 * - 只加载脚本与声明接口，不自动完成挑战，也不请求后端校验。
 */

export interface TencentCaptchaResult {
  ret: number;
  ticket?: string | null;
  randstr?: string | null;
  errorCode?: number;
  errorMessage?: string;
}

export interface TencentCaptchaInstance {
  show(): void;
  destroy(): void;
}

export interface TencentCaptchaOptions {
  userLanguage?: string;
  enableAutoCheck?: boolean;
  type?: 'popup' | 'inline';
}

export type TencentCaptchaConstructor = new (
  appId: string,
  callback: (result: TencentCaptchaResult) => void,
  options?: TencentCaptchaOptions,
) => TencentCaptchaInstance;

declare global {
  interface Window {
    TencentCaptcha?: TencentCaptchaConstructor;
  }
}

/** 中国站官方脚本地址（与任务书一致）。 */
export const TENCENT_CAPTCHA_SCRIPT_SRC = 'https://turing.captcha.qcloud.com/TCaptcha.js';

let loader: Promise<TencentCaptchaConstructor> | null = null;

/**
 * 加载腾讯验证码脚本并返回全局构造函数。
 *
 * - 模块级单例：同一页面只注入一个 script 标签。
 * - 已存在全局构造函数时直接复用。
 * - 失败后清除缓存，允许调用方重试。
 */
export function loadTencentCaptcha(): Promise<TencentCaptchaConstructor> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('腾讯验证码只能在浏览器中加载'));
  }
  const existing = window.TencentCaptcha;
  if (existing !== undefined) {
    return Promise.resolve(existing);
  }
  if (loader !== null) {
    return loader;
  }

  const pending = new Promise<TencentCaptchaConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TENCENT_CAPTCHA_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      const ctor = window.TencentCaptcha;
      if (ctor !== undefined) {
        resolve(ctor);
        return;
      }
      reject(new Error('腾讯验证码脚本已加载但接口未就绪'));
    };
    script.onerror = () => {
      reject(new Error('腾讯验证码脚本加载失败'));
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
