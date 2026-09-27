/**
 * 余额与订单请求层（只调用固定客户接口路径，纯业务、无 UI）。
 *
 * 契约来源：design/customer-console.md 第 3 节、src/features/billing/types.ts。
 *
 * 边界：
 * - 全部请求走注入的 ApiRequester（统一 Bearer 与 /api/portal 前缀），
 *   本模块不直接使用 fetch，不拼任意后端地址。
 * - 只调用以下固定路径：
 *   GET  /payment/config、GET /payment/checkout-info、
 *   GET  /payment/orders/my、GET /payment/orders/:id、
 *   POST /payment/orders/:id/cancel、POST /payment/orders。
 * - 创建订单不自动重试：每次调用生成一个独立幂等键，超时或失败由 UI 决定是否重试。
 * - 支付配置未开启时只返回禁用配置，不请求 checkout-info，避免无谓失败。
 */

import type { ApiRequester } from '../auth/types';
import type { PageResult } from '../keys/types';
import {
  parseBillingConfig,
  parseBillingReturnUrl,
  parseOrderPage,
  parsePaymentLaunch,
  parsePaymentOrder,
} from './adapter';
import type { BillingConfig, PaymentLaunch, PaymentOrder } from './types';

export interface OrderQuery {
  page: number;
  pageSize: number;
  status?: string;
}

export interface CreatePaymentOrderInput {
  amount: number;
  methodId: string;
  returnUrl: string;
  isMobile?: boolean;
}

/** 生成一个 UUID 作为创建订单的幂等键；环境缺少 crypto 时退化为本地随机。 */
export function createIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi !== undefined && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  if (cryptoApi !== undefined && typeof cryptoApi.getRandomValues === 'function') {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const random = (): string =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0');
  return `${random()}${random()}-${random()}-4${random().slice(1)}-a${random().slice(1)}-${random()}${random()}${random()}`;
}

/** 当前浏览器 origin；服务端渲染或非浏览器环境返回 null。 */
function currentOrigin(): string | null {
  const location = (globalThis as { location?: { origin?: unknown } }).location;
  const origin = location?.origin;
  return typeof origin === 'string' && origin !== '' ? origin : null;
}

/** 订单 id 必须是正整数，避免把任意字符串拼进路径。 */
function requireOrderId(id: number): number {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('订单编号不正确');
  }
  return id;
}

/**
 * 读取充值配置。
 *
 * 先取 /payment/config；未开启时直接返回禁用配置，不再请求 checkout-info。
 * 已开启时再取 /payment/checkout-info，合并支付方式与展示字段。
 */
export async function fetchBillingConfig(
  request: ApiRequester,
  signal?: AbortSignal,
): Promise<BillingConfig> {
  const configData = await request<unknown>('/payment/config', {
    method: 'GET',
    auth: true,
    ...(signal === undefined ? {} : { signal }),
  });
  const config = parseBillingConfig(configData);
  if (!config.enabled) {
    return config;
  }
  const checkoutData = await request<unknown>('/payment/checkout-info', {
    method: 'GET',
    auth: true,
    ...(signal === undefined ? {} : { signal }),
  });
  return parseBillingConfig(configData, checkoutData);
}

/** 当前账号的充值订单分页；空列表合法。 */
export async function fetchOrders(
  request: ApiRequester,
  query: OrderQuery,
  signal?: AbortSignal,
): Promise<PageResult<PaymentOrder>> {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('page_size', String(query.pageSize));
  if (typeof query.status === 'string' && query.status.trim() !== '') {
    params.set('status', query.status.trim());
  }
  const data = await request<unknown>(`/payment/orders/my?${params.toString()}`, {
    method: 'GET',
    auth: true,
    ...(signal === undefined ? {} : { signal }),
  });
  return parseOrderPage(data, { page: query.page, pageSize: query.pageSize });
}

/** 单个订单详情。 */
export async function fetchOrder(
  request: ApiRequester,
  id: number,
  signal?: AbortSignal,
): Promise<PaymentOrder> {
  const orderId = requireOrderId(id);
  const data = await request<unknown>(`/payment/orders/${orderId}`, {
    method: 'GET',
    auth: true,
    ...(signal === undefined ? {} : { signal }),
  });
  return parsePaymentOrder(data);
}

/** 取消待支付订单。写操作不重试。 */
export async function cancelOrder(
  request: ApiRequester,
  id: number,
  signal?: AbortSignal,
): Promise<void> {
  const orderId = requireOrderId(id);
  await request<unknown>(`/payment/orders/${orderId}/cancel`, {
    method: 'POST',
    auth: true,
    ...(signal === undefined ? {} : { signal }),
  });
}

/**
 * 创建余额充值订单并解析支付入口。
 *
 * - 请求体固定 order_type='balance'、payment_source='hosted_redirect'；
 * - Idempotency-Key 每次调用生成一次，不在内部重试；
 * - returnUrl 必须是当前站点的绝对 http(s) 地址且路径为后端要求的 /payment/result，
 *   非法 scheme、userinfo 或跨域一律在发请求前拒绝。
 */
export async function createPaymentOrder(
  request: ApiRequester,
  input: CreatePaymentOrderInput,
  signal?: AbortSignal,
): Promise<PaymentLaunch> {
  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('充值金额不正确');
  }
  const methodId = typeof input.methodId === 'string' ? input.methodId.trim() : '';
  if (methodId === '') {
    throw new Error('请选择支付方式');
  }
  const returnUrl = parseBillingReturnUrl(input.returnUrl, currentOrigin());

  const body: Record<string, unknown> = {
    amount: input.amount,
    payment_type: methodId,
    order_type: 'balance',
    return_url: returnUrl,
    payment_source: 'hosted_redirect',
  };
  if (typeof input.isMobile === 'boolean') {
    body.is_mobile = input.isMobile;
  }

  const data = await request<unknown>('/payment/orders', {
    method: 'POST',
    auth: true,
    body,
    headers: { 'Idempotency-Key': createIdempotencyKey() },
    ...(signal === undefined ? {} : { signal }),
  });
  return parsePaymentLaunch(data);
}
