'use client';

/**
 * 阿里云验证码官方脚本的单例加载器。
 *
 * 事实来源：旧前端 `frontend/src/components/AliyunCaptchaWidget.vue` 的必需段。
 *
 * - 全局配置 `window.AliyunCaptchaConfig = { region, prefix }` 必须在脚本加载前就位。
 * - 脚本地址固定为 `https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js`。
 * - 入口 `window.initAliyunCaptcha(options)`：popup 模式由 `button` 触发、`element` 承载，
 *   `captchaVerifyCallback(captchaVerifyParam)` 里拿到一次性参数；
 *   本模块不请求后端校验，只把参数交给调用方（随业务请求的 turnstile_token 提交）。
 * - 弹窗 DOM 由 SDK 自己挂到 body，id 固定为 `aliyunCaptcha-window-popup` /
 *   `aliyunCaptcha-mask`，卸载时需要清理，否则下次挂载回调会重复触发。
 */

export interface AliyunCaptchaVerifyResult {
  captchaResult: boolean;
  bizResult?: boolean;
}

export interface AliyunCaptchaInitOptions {
  SceneId: string;
  prefix: string;
  mode: 'popup' | 'embed';
  element: string;
  button: string;
  captchaVerifyCallback: (
    captchaVerifyParam: string,
  ) => AliyunCaptchaVerifyResult | Promise<AliyunCaptchaVerifyResult>;
  onBizResultCallback: (bizResult: boolean) => void;
  getInstance: (instance: unknown) => void;
  slideStyle?: { width: number; height: number };
  language?: string;
}

declare global {
  interface Window {
    initAliyunCaptcha?: (options: AliyunCaptchaInitOptions) => void;
    AliyunCaptchaConfig?: { region: string; prefix: string };
  }
}

/** 阿里云验证码官方脚本地址。 */
export const ALIYUN_CAPTCHA_SCRIPT_SRC =
  'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js';

/** SDK 自己创建的弹窗与遮罩节点 id。 */
export const ALIYUN_CAPTCHA_POPUP_ID = 'aliyunCaptcha-window-popup';
export const ALIYUN_CAPTCHA_MASK_ID = 'aliyunCaptcha-mask';

export type AliyunCaptchaRegion = 'cn' | 'sgp';

/** region 只接受已知的 'sgp'，其余按国内站处理（与旧组件一致）。 */
export function normalizeAliyunRegion(value: string | null | undefined): AliyunCaptchaRegion {
  return value === 'sgp' ? 'sgp' : 'cn';
}

let loader: Promise<void> | null = null;

/**
 * 写入全局配置并加载阿里云验证码脚本。
 *
 * - 每次调用都会重新写入 `AliyunCaptchaConfig`（prefix/region 全站一致，重复赋值无副作用）。
 * - 脚本单例：已存在 `window.initAliyunCaptcha` 时直接返回。
 * - 失败后清除缓存，允许调用方重试。
 */
export function loadAliyunCaptcha(options: {
  prefix: string;
  region: AliyunCaptchaRegion;
}): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('阿里云验证码只能在浏览器中加载'));
  }
  window.AliyunCaptchaConfig = { region: options.region, prefix: options.prefix };
  if (window.initAliyunCaptcha !== undefined) {
    return Promise.resolve();
  }
  if (loader !== null) {
    return loader;
  }

  const pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ALIYUN_CAPTCHA_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.initAliyunCaptcha !== undefined) {
        resolve();
        return;
      }
      reject(new Error('阿里云验证码脚本已加载但接口未就绪'));
    };
    script.onerror = () => {
      reject(new Error('阿里云验证码脚本加载失败'));
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

/** 移除 SDK 残留的弹窗与遮罩（卸载/重置时调用，重复调用安全）。 */
export function removeAliyunCaptchaNodes(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.getElementById(ALIYUN_CAPTCHA_MASK_ID)?.remove();
  document.getElementById(ALIYUN_CAPTCHA_POPUP_ID)?.remove();
}
