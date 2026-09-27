/**
 * 余额与订单适配（纯函数，无网络、无副作用、与渲染无关）。
 *
 * 契约来源：src/features/billing/types.ts 与 design/customer-console.md 第 3 节。
 * 输入是已经去掉 API 包装的原始对象（request 返回的 data），输出只包含冻结类型字段，
 * 不透传后端额外字段。
 *
 * 边界：
 * - 数字一律从 unknown 严格校验：缺失或 null 的金额/编号按错误处理，绝不猜成 0；
 *   限额类字段（min/max/fee_rate/daily_limit）缺失按 0（0 = 不限）处理。
 * - 支付币种只取后端支付配置；缺失或非法时回落到旧前端的 CNY 默认值，
 *   不根据模型美元单价推导支付币种。
 * - 充值费率（PaymentMethod.feeRate）取 checkout 顶层 recharge_fee_rate；
 *   checkout 缺失时回落 config.recharge_fee_rate；顶层均缺失才退回条目 fee_rate（旧契约），
 *   因为聚合后的条目 fee_rate 恒为 0，不能作为真实费率。
 * - dailyLimit 是后台配置的日累计上限（0 = 不限），dailyRemaining 只在后端明确返回时才有值，
 *   两者不混用：缺失的 daily_remaining 表示未知，不是无限额，也不是 0。
 * - 订单状态只认已冻结枚举，其余一律 UNKNOWN。
 * - pay_url / oauth.authorize_url 仅接受 http(s) 且无 userinfo；qr_code 是二维码内容，
 *   原样返回，绝不当作 URL 或 HTML 使用。
 */

import type { PageResult } from '../keys/types';
import type {
  BillingConfig,
  OrderStatus,
  PaymentLaunch,
  PaymentMethod,
  PaymentOrder,
} from './types';

type UnknownRecord = Record<string, unknown>;

/** 旧前端 currency.ts 的默认支付币种。 */
export const DEFAULT_PAYMENT_CURRENCY = 'CNY';

/** 支付回跳固定路径；与后端 paymentResultReturnPath 保持一致。 */
export const BILLING_RETURN_PATH = '/payment/result';

/** 后台 payment_type id 到展示名的内置映射；display_name 优先。 */
const METHOD_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  alipay: '支付宝',
  alipay_direct: '支付宝',
  wxpay: '微信',
  wxpay_direct: '微信',
  stripe: '银行卡',
  airwallex: 'Airwallex',
};

/** 已冻结的订单状态枚举；未知取值归为 UNKNOWN。 */
const ORDER_STATUSES: ReadonlySet<string> = new Set<string>([
  'PENDING',
  'PAID',
  'RECHARGING',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
  'FAILED',
  'REFUND_REQUESTED',
  'REFUNDING',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'REFUND_FAILED',
  'UNKNOWN',
]);

/** 微信 JSAPI 只保留这些字符串键，避免把后端额外字段带进页面。 */
const JSAPI_KEYS = ['appId', 'timeStamp', 'nonceStr', 'package', 'signType', 'paySign'] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string): Error {
  return new Error(`Invalid billing field: ${path}`);
}

function requiredString(record: UnknownRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw invalid(key);
  }
  return value.trim();
}

function optionalString(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw invalid(key);
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** 金额/编号：必须是有限数且非负，缺失、null 或非法都抛错，不猜 0。 */
function requiredNonNegativeNumber(record: UnknownRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid(key);
  }
  return value;
}

/** 限额类数字：缺失/null 用 fallback（0 = 不限），出现但非法则抛错。 */
function nonNegativeNumberOr(record: UnknownRecord, key: string, fallback: number): number {
  const value = record[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid(key);
  }
  return value;
}

/** 计数字段：缺失/null 用 fallback，出现但非法则抛错。 */
function countOr(value: unknown, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid('count');
  }
  return value;
}

/** 只接受 http/https 且无用户名密码的绝对 URL，其余返回 null。 */
export function safePaymentUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  if (url.username !== '' || url.password !== '') {
    return null;
  }
  return url.toString();
}

/** 支付币种：三位字母代码原样大写，缺失或非法回落到 CNY。 */
export function normalizePaymentCurrency(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_PAYMENT_CURRENCY;
}

/** 展示名：优先后端 display_name，其次内置映射，最后回落到原始 id。 */
export function paymentMethodDisplayName(id: string, displayName?: unknown): string {
  const trimmed = typeof displayName === 'string' ? displayName.trim() : '';
  if (trimmed !== '') {
    return trimmed;
  }
  const normalized = id.trim().toLowerCase();
  return METHOD_DISPLAY_NAMES[normalized] ?? (id.trim() === '' ? id : id.trim());
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  if (typeof value !== 'string') {
    return 'UNKNOWN';
  }
  const normalized = value.trim().toUpperCase();
  return ORDER_STATUSES.has(normalized) ? (normalized as OrderStatus) : 'UNKNOWN';
}

/**
 * 日剩余：只在后端明确返回 daily_remaining 时取值；缺失/null 表示未知，不是无限额。
 * 显式返回 0 表示当日额度已耗尽。出现但非法则抛错。
 */
function parseDailyRemaining(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid('daily_remaining');
  }
  return value;
}

/**
 * 解析单个支付方式。id 保留后台 payment_type 原值，不重写别名。
 * available 只在显式为 false 时不可用；缺失视为可用，由后端最终校验。
 * feeRate 由调用方传入真实充值费率（checkout/config 顶层），不读条目 fee_rate。
 */
export function parsePaymentMethod(
  id: string,
  value: unknown,
  feeRateOverride?: number,
): PaymentMethod {
  if (!isRecord(value)) {
    throw invalid(`methods.${id}`);
  }
  const entryFeeRate = nonNegativeNumberOr(value, 'fee_rate', 0);
  return {
    id,
    name: paymentMethodDisplayName(id, value.display_name),
    currency: normalizePaymentCurrency(value.currency),
    min: nonNegativeNumberOr(value, 'single_min', 0),
    max: nonNegativeNumberOr(value, 'single_max', 0),
    dailyRemaining: parseDailyRemaining(value.daily_remaining),
    dailyLimit: nonNegativeNumberOr(value, 'daily_limit', 0),
    feeRate: feeRateOverride ?? entryFeeRate,
    available: value.available !== false,
  };
}

function parseMethods(value: unknown, feeRate: number | null): PaymentMethod[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!isRecord(value)) {
    throw invalid('checkout.methods');
  }
  const methods: PaymentMethod[] = [];
  for (const [rawId, entry] of Object.entries(value)) {
    const id = rawId.trim();
    if (id === '') {
      continue;
    }
    methods.push(
      feeRate === null ? parsePaymentMethod(id, entry) : parsePaymentMethod(id, entry, feeRate),
    );
  }
  return methods;
}

/** 读取顶层充值费率：出现但非法则抛错，缺失返回 null（保持顶层 0 为真实 0）。 */
function optionalFeeRate(record: UnknownRecord): number | null {
  const value = record.recharge_fee_rate;
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid('recharge_fee_rate');
  }
  return value;
}

/**
 * 解析 /payment/config，可选合并 /payment/checkout-info。
 *
 * - enabled 以后端 /payment/config 的 `enabled` 为准（严格 === true）；
 *   为兼容旧契约，`enabled` 缺失时才读 `payment_enabled`。两者都存在时 `enabled` 优先，
 *   避免真实已开启却显示关闭。未开启时不解析 methods（只余额）。
 * - min/max 取支付配置的全局 min_amount/max_amount（0 = 不限）。
 * - dailyLimit 取配置的 daily_limit（0 = 不限），是上限而不是剩余额度。
 * - methods 只在 enabled 且提供 checkout 时解析，保留后台 payment_type 原值；
 *   费率统一用 checkout/config 顶层 recharge_fee_rate。
 * - 不读取 plans，也不根据模型报价推导支付币种。
 */
export function parseBillingConfig(configValue: unknown, checkoutValue?: unknown): BillingConfig {
  if (!isRecord(configValue)) {
    throw invalid('config');
  }

  // 后端 PaymentConfig.Enabled 的 JSON 字段是 enabled；payment_enabled 仅为旧契约兼容，
  // enabled 存在时严格以它为准，避免把真实已开启的支付判成关闭。
  const enabled =
    configValue.enabled !== undefined
      ? configValue.enabled === true
      : configValue.payment_enabled === true;
  const balanceDisabled = configValue.balance_disabled === true;
  const min = nonNegativeNumberOr(configValue, 'min_amount', 0);
  const max = nonNegativeNumberOr(configValue, 'max_amount', 0);
  const multiplierValue = configValue.balance_recharge_multiplier;
  let multiplier = 1;
  if (multiplierValue !== undefined && multiplierValue !== null) {
    if (
      typeof multiplierValue !== 'number' ||
      !Number.isFinite(multiplierValue) ||
      multiplierValue <= 0
    ) {
      throw invalid('balance_recharge_multiplier');
    }
    multiplier = multiplierValue;
  }

  const configKey = optionalString(configValue, 'stripe_publishable_key');
  const configHelp = optionalString(configValue, 'help_text');
  const configDailyLimit = nonNegativeNumberOr(configValue, 'daily_limit', 0);
  const configFeeRate = optionalFeeRate(configValue);

  let methods: PaymentMethod[] = [];
  let stripePublicKey = configKey;
  let helpText = configHelp;

  if (checkoutValue !== undefined && checkoutValue !== null) {
    if (!isRecord(checkoutValue)) {
      throw invalid('checkout');
    }
    if (enabled) {
      // 真实充值费率在 checkout 顶层；缺失才回落 config，最后才退回条目 fee_rate（旧契约）。
      const checkoutFeeRate = optionalFeeRate(checkoutValue);
      methods = parseMethods(checkoutValue.methods, checkoutFeeRate ?? configFeeRate);
    }
    stripePublicKey = optionalString(checkoutValue, 'stripe_publishable_key') ?? configKey;
    helpText = optionalString(checkoutValue, 'help_text') ?? configHelp;
  }

  return {
    enabled,
    balanceDisabled,
    min,
    max,
    multiplier,
    dailyLimit: configDailyLimit,
    methods,
    stripePublicKey,
    helpText,
  };
}

/** 解析单个订单；金额/编号必须存在且合法，未知状态归为 UNKNOWN。 */
export function parsePaymentOrder(value: unknown): PaymentOrder {
  if (!isRecord(value)) {
    throw invalid('order');
  }
  const completedAtRaw = value.completed_at;
  let completedAt: string | null = null;
  if (completedAtRaw !== undefined && completedAtRaw !== null) {
    if (typeof completedAtRaw !== 'string' || completedAtRaw.trim() === '') {
      throw invalid('completed_at');
    }
    completedAt = completedAtRaw.trim();
  }

  return {
    id: requiredNonNegativeNumber(value, 'id'),
    amount: requiredNonNegativeNumber(value, 'amount'),
    payAmount: requiredNonNegativeNumber(value, 'pay_amount'),
    currency: normalizePaymentCurrency(value.currency),
    method: optionalString(value, 'payment_type') ?? '',
    tradeNumber: optionalString(value, 'out_trade_no') ?? '',
    status: normalizeOrderStatus(value.status),
    createdAt: requiredString(value, 'created_at'),
    expiresAt: requiredString(value, 'expires_at'),
    completedAt,
  };
}

/** 解析分页订单；空列表合法，缺失分页字段回落到本次请求参数。 */
export function parseOrderPage(
  value: unknown,
  fallback: { page: number; pageSize: number },
): PageResult<PaymentOrder> {
  if (!isRecord(value)) {
    throw invalid('orders');
  }
  const itemsRaw = value.items;
  if (!Array.isArray(itemsRaw)) {
    throw invalid('orders.items');
  }
  const items = itemsRaw.map((entry) => parsePaymentOrder(entry));

  const page = countOr(value.page, fallback.page);
  const pageSize = countOr(value.page_size ?? value.pageSize, fallback.pageSize);
  const total = countOr(value.total, 0);
  const computedPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  // 后端保证 pages 至少为 1；缺失或 0 时按计算值兜底，避免出现 0 页。
  const pages = Math.max(1, countOr(value.pages, computedPages));

  return { items, total, page, pageSize, pages };
}

/** jsapi/jsapi_payload 只保留白名单字符串键；无有效键时返回 null。 */
function parseJsapi(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null;
  }
  const result: Record<string, string> = {};
  for (const key of JSAPI_KEYS) {
    const entry = value[key];
    if (typeof entry === 'string' && entry !== '') {
      result[key] = entry;
    }
  }
  return Object.keys(result).length === 0 ? null : result;
}

/**
 * 解析创建订单返回的支付入口。
 *
 * - pay_url / oauth.authorize_url 仅接受 http(s) 无 userinfo；
 * - qr_code 是二维码内容，原样返回，调用方不得当作 URL 或 HTML；
 * - client_secret / intent_id 仅供内存中的 SDK 使用；
 * - 后端没有返回任何可用入口时全部为 null，由 UI 提示稍后重试，绝不伪造支付地址。
 */
export function parsePaymentLaunch(value: unknown): PaymentLaunch {
  if (!isRecord(value)) {
    throw invalid('launch');
  }
  const oauth = isRecord(value.oauth) ? value.oauth : null;
  const jsapiRaw =
    value.jsapi !== undefined && value.jsapi !== null ? value.jsapi : value.jsapi_payload;

  return {
    orderId: requiredNonNegativeNumber(value, 'order_id'),
    amount: requiredNonNegativeNumber(value, 'amount'),
    payAmount: requiredNonNegativeNumber(value, 'pay_amount'),
    currency: normalizePaymentCurrency(value.currency),
    expiresAt: requiredString(value, 'expires_at'),
    payUrl: safePaymentUrl(value.pay_url),
    qrCode: optionalString(value, 'qr_code'),
    clientSecret: optionalString(value, 'client_secret'),
    intentId: optionalString(value, 'intent_id'),
    paymentType: optionalString(value, 'payment_type') ?? '',
    paymentEnvironment: optionalString(value, 'payment_env'),
    countryCode: optionalString(value, 'country_code'),
    oauthUrl: oauth === null ? null : safePaymentUrl(oauth.authorize_url),
    jsapi: parseJsapi(jsapiRaw),
  };
}

/** 是否拿到了可继续支付的入口；false 时 UI 只能提示稍后重试查询。 */
export function hasPaymentEntry(launch: PaymentLaunch): boolean {
  return (
    launch.payUrl !== null ||
    launch.qrCode !== null ||
    launch.clientSecret !== null ||
    launch.oauthUrl !== null ||
    launch.jsapi !== null
  );
}

/**
 * 校验回跳地址：必须是绝对 http(s)、无 userinfo、路径为后端要求的 /payment/result；
 * 传入当前 origin 时还必须同源。查询参数允许，由 UI 提供。
 * 旧 /console/billing 路径已不再合法（后端会拒绝），这里提前拦截。
 */
export function parseBillingReturnUrl(value: unknown, currentOrigin: string | null): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('return_url 必须是当前站点的绝对地址');
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('return_url 不是有效地址');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('return_url 只允许 http(s) 地址');
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('return_url 不允许包含账号信息');
  }
  if (url.pathname !== BILLING_RETURN_PATH) {
    throw new Error(`return_url 路径必须是 ${BILLING_RETURN_PATH}`);
  }
  if (currentOrigin !== null && url.origin !== currentOrigin) {
    throw new Error('return_url 必须是当前站点地址');
  }
  return url.toString();
}
