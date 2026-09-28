'use client';

/**
 * 余额与订单的展示格式化（纯函数 + 状态徽标，无网络、无副作用）。
 *
 * 契约来源：src/features/billing/types.ts、design/console-pages.md 余额与订单章节。
 *
 * 边界：
 * - 充值金额（order.amount / launch.amount）是后端已换算的到账 USD，固定按 USD 展示；
 *   order.payAmount 才是 order.currency 的真实付款额，必须带该币种格式化。
 * - 时间来自后端 ISO 文本，按浏览器本地时区展示；缺失或非法显示占位，不伪造时间。
 * - 状态语义由 validation.orderStatusLabel 提供，徽标颜色只是辅助，不能是唯一含义。
 */

import { Badge } from '../../components/ui/badge';
import type { BadgeVariant } from '../../components/ui/badge';
import { formatUsd } from '../../lib/money';
import type { OrderStatus, PaymentMethod, PaymentOrder } from './types';
import { orderStatusLabel } from './validation';

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const rateFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });

/** 到账金额（USD）：后端已换算，统一走 lib/money 的两位小数格式；缺失或非法显示占位而不是 0。 */
export function formatOrderUsd(value: number): string {
  return formatUsd(value);
}

/** 后端 ISO 时间：按本地时区展示；缺失或无法解析显示占位。 */
export function formatOrderDateTime(value: string | null): string {
  if (value === null || value.trim() === '') {
    return '—';
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return '—';
  }
  return dateTimeFormatter.format(new Date(timestamp));
}

/** 手续费率展示：百分数数值，最多两位小数。 */
export function formatFeeRate(value: number): string {
  return Number.isFinite(value) ? rateFormatter.format(value) : '0';
}

/** 订单号：优先后端支付单号，缺失时回落到订单编号，避免出现空单元格。 */
export function formatOrderNumber(order: PaymentOrder): string {
  const tradeNumber = order.tradeNumber.trim();
  return tradeNumber === '' ? `#${order.id}` : tradeNumber;
}

/** 状态徽标语义：等待入账用警告色，失败用危险色，未知不冒充成功。 */
export function orderStatusBadgeVariant(status: OrderStatus): BadgeVariant {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'PENDING':
    case 'PAID':
    case 'RECHARGING':
    case 'REFUND_REQUESTED':
    case 'REFUNDING':
    case 'REFUND_PENDING':
    case 'PARTIALLY_REFUNDED':
      return 'warning';
    case 'FAILED':
    case 'REFUND_FAILED':
      return 'destructive';
    default:
      return 'neutral';
  }
}

/** 订单状态徽标：文字来自 validation，颜色只做辅助。 */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={orderStatusBadgeVariant(status)}>{orderStatusLabel(status)}</Badge>;
}

/** 支付方式展示名：优先后台配置里的 name，缺失时显示后端原始 id。 */
export function paymentMethodLabel(methodId: string, methods: readonly PaymentMethod[]): string {
  const trimmed = methodId.trim();
  if (trimmed === '') {
    return '未知方式';
  }
  const matched = methods.find((item) => item.id === trimmed);
  return matched === undefined ? trimmed : matched.name;
}

/** 安全错误文案：只透传本地 Error 信息，其余用调用方兜底，不回显后端原文。 */
export function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return fallback;
}
