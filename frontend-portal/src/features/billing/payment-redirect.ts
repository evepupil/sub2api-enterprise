/**
 * 付款跳转与回跳地址的纯函数（不访问网络、不写存储、不改 DOM）。
 *
 * 契约来源：design/console-pages.md 余额与订单章节、src/features/billing/types.ts。
 *
 * 边界：
 * - paymentReturnUrl 只生成「当前站点 origin + /payment/result?order_id=<id>」，
 *   路径固定为 BILLING_RETURN_PATH，不接受调用方传入任意 path，生成后再复用
 *   parseBillingReturnUrl 校验一次，避免把回跳地址做成开放重定向。
 * - safeExternalUrl 只放行绝对 http(s) 且不含用户名密码的地址；
 *   javascript:、data:、相对路径、带 userinfo 的地址一律返回 null，
 *   绝不把后端返回值当作站内跳转目标。
 * - isWechatBrowser 只做 UA 文本匹配，不读取 navigator，便于单独调用与测试。
 */

import { BILLING_RETURN_PATH, parseBillingReturnUrl, safePaymentUrl } from './adapter';

/** 当前浏览器 origin；服务端渲染或非浏览器环境返回 null。 */
function currentOrigin(): string | null {
  const location = (globalThis as { location?: { origin?: unknown } }).location;
  const origin = location?.origin;
  return typeof origin === 'string' && origin !== '' ? origin : null;
}

/**
 * 支付回跳地址：当前站点 origin + /payment/result?order_id=<id>。
 *
 * orderId 必须是正整数；origin 缺省取 window.location.origin，缺失时抛错，
 * 绝不退化成相对路径或任意站点地址。Stripe 的 return_url 与 Airwallex 的
 * successUrl 都只用于触发订单状态查询，不代表已到账。
 */
export function paymentReturnUrl(orderId: number, origin?: string): string {
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error('订单编号不正确');
  }
  const base = origin ?? currentOrigin();
  if (base === null) {
    throw new Error('当前环境没有可用的站点地址');
  }
  let normalizedBase: string;
  try {
    const parsedBase = new URL(base);
    if (parsedBase.protocol !== 'http:' && parsedBase.protocol !== 'https:') {
      throw new Error('协议不允许');
    }
    normalizedBase = parsedBase.origin;
  } catch {
    throw new Error('当前站点地址无效');
  }
  const url = new URL(BILLING_RETURN_PATH, normalizedBase);
  url.searchParams.set('order_id', String(orderId));
  return parseBillingReturnUrl(url.toString(), normalizedBase);
}

/**
 * 外部付款地址白名单：只接受绝对 http(s) 且无用户名密码。
 * 非法 scheme（javascript:、data: 等）、相对路径和 userinfo 一律返回 null。
 */
export function safeExternalUrl(value: unknown): string | null {
  return safePaymentUrl(value);
}

/** 微信内置浏览器判定：仅匹配 UA 文本，不做任何网络或 SDK 探测。 */
const WECHAT_UA_PATTERN = /micromessenger/i;

export function isWechatBrowser(userAgent: string | null | undefined): boolean {
  return typeof userAgent === 'string' && WECHAT_UA_PATTERN.test(userAgent);
}
