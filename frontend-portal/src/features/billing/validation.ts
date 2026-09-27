/**
 * 充值金额校验与订单状态判定（纯函数，无网络、无副作用）。
 *
 * 契约来源：src/features/billing/types.ts 与 design/customer-console.md 第 3 节。
 *
 * 边界：
 * - 金额从字符串严格解析：只接受十进制、正有限数，小数位数不超过该币种允许位数
 *   （JPY/ISK/UGX 等 0 位，KWD 等 3 位，其余 2 位）；
 *   空串、0、负数、指数、多余小数位、非法字符一律返回错误，绝不静默取 0。
 * - 金额上限综合全局配置（0 = 不限）、单笔限制（0 = 不限）、
 *   日上限（dailyLimit，0 = 不限）、日剩余（null = 未知不限）、支付方式可用性、
 *   余额充值开关和支付总开关（enabled=false 时禁止充值）。
 *   日上限是配置上限，日剩余是后端明确返回的剩余额度，两者不混用；
 *   最终能否扣款由后端判断。
 * - 金额展示沿用该支付方式的币种；未知币种回落 CNY。
 * - PAID / RECHARGING 只表示等待入账，不等于到账；仅 COMPLETED 表示已到账。
 *   已过期、已取消、已失败等终态不再轮询。
 *
 * 金额精度与应付金额计算（currencyFractionDigits / calculatePaymentTotal）
 * 从 ./currency 重导出，供视图统一从本模块引用。
 */

import type { BillingConfig, OrderStatus, PaymentMethod } from './types';
import { DEFAULT_PAYMENT_CURRENCY } from './adapter';
import { currencyFractionDigits } from './currency';

export { calculatePaymentTotal, currencyFractionDigits } from './currency';

/** 金额输入校验结果：成功时 error 为 null，失败时 amount 为 null。 */
export type RechargeAmountValidation =
  { amount: number; error: null } | { amount: null; error: string };

/** 金额格式：整数部分至少一位，小数位由币种精度决定。 */
function amountPattern(digits: number): RegExp {
  return digits <= 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`);
}

/** 订单状态中文展示；未知状态明确标注，不猜测。 */
const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  PENDING: '待支付',
  PAID: '已支付',
  RECHARGING: '入账中',
  COMPLETED: '已完成',
  EXPIRED: '已过期',
  CANCELLED: '已取消',
  FAILED: '支付失败',
  REFUND_REQUESTED: '退款申请中',
  REFUNDING: '退款中',
  REFUND_PENDING: '退款处理中',
  PARTIALLY_REFUNDED: '部分退款',
  REFUNDED: '已退款',
  REFUND_FAILED: '退款失败',
  UNKNOWN: '未知状态',
};

/** 支付方式币种：三位字母代码原样大写，非法回落 CNY（与旧前端一致）。 */
function currencyOf(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_PAYMENT_CURRENCY;
}

/** 按币种格式化金额；格式化失败时回落到「币种 + 两位小数」，绝不返回空串。 */
export function formatBillingMoney(amount: number, currency: string): string {
  const normalized = currencyOf(currency);
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalized,
      currencyDisplay: 'narrowSymbol',
    }).format(value);
  } catch {
    return `${normalized} ${value.toFixed(2)}`;
  }
}

/**
 * 校验用户输入的充值金额。
 *
 * 检查顺序：格式与币种精度 → 正数 → 支付总开关 → 余额充值开关 → 支付方式可用性 →
 * 全局上下限 → 单笔上下限 → 日上限 → 日剩余。所有限额为 0 或 null 均表示不限。
 */
export function validateRechargeAmount(
  value: string,
  method: PaymentMethod,
  config: BillingConfig,
): RechargeAmountValidation {
  const currency = currencyOf(method.currency);
  const digits = currencyFractionDigits(currency);
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') {
    return { amount: null, error: '请输入充值金额' };
  }
  if (!amountPattern(digits).test(text)) {
    const hint = digits <= 0 ? '金额只能是整数' : `金额最多 ${digits} 位小数，且只能包含数字`;
    return { amount: null, error: hint };
  }
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { amount: null, error: '金额必须大于 0' };
  }

  if (!config.enabled) {
    return { amount: null, error: '当前站点暂未开通充值' };
  }
  if (config.balanceDisabled) {
    return { amount: null, error: '当前账号暂不支持余额充值' };
  }
  if (!method.available) {
    return { amount: null, error: '该支付方式当前不可用，请更换支付方式' };
  }

  if (config.min > 0 && amount < config.min) {
    return {
      amount: null,
      error: `单次充值不能低于 ${formatBillingMoney(config.min, currency)}`,
    };
  }
  if (config.max > 0 && amount > config.max) {
    return {
      amount: null,
      error: `单次充值不能高于 ${formatBillingMoney(config.max, currency)}`,
    };
  }

  if (method.min > 0 && amount < method.min) {
    return {
      amount: null,
      error: `该支付方式最低 ${formatBillingMoney(method.min, currency)}`,
    };
  }
  if (method.max > 0 && amount > method.max) {
    return {
      amount: null,
      error: `该支付方式最高 ${formatBillingMoney(method.max, currency)}`,
    };
  }

  if (method.dailyLimit !== undefined && method.dailyLimit > 0 && amount > method.dailyLimit) {
    return {
      amount: null,
      error: `超出每日充值上限 ${formatBillingMoney(method.dailyLimit, currency)}`,
    };
  }
  if (config.dailyLimit !== undefined && config.dailyLimit > 0 && amount > config.dailyLimit) {
    return {
      amount: null,
      error: `超出每日充值上限 ${formatBillingMoney(config.dailyLimit, currency)}`,
    };
  }

  if (method.dailyRemaining !== null && amount > method.dailyRemaining) {
    return {
      amount: null,
      error: `超出今日剩余额度 ${formatBillingMoney(method.dailyRemaining, currency)}`,
    };
  }

  return { amount, error: null };
}

/**
 * 是否属于「等待入账」状态，需要继续轮询订单。
 * PAID / RECHARGING 只代表支付已确认，余额尚未到账。
 */
export function isOrderPending(status: OrderStatus): boolean {
  return status === 'PENDING' || status === 'PAID' || status === 'RECHARGING';
}

/** 是否已确认到账。仅 COMPLETED 表示余额已入账。 */
export function isOrderCompleted(status: OrderStatus): boolean {
  return status === 'COMPLETED';
}

/** 订单状态中文展示；未知状态返回「未知状态」，不猜测为成功或失败。 */
export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? ORDER_STATUS_LABELS.UNKNOWN;
}
