import { formatInteger, formatUsd, RECHARGE_LIMITS, USD_PREFIX } from '@/lib/console';

/**
 * 充值弹窗的金额规则。兑换码直接交给后端校验（后端的码区分大小写、格式不止一种），这里不再管。
 */

/** 数字输入框里的文字 → 数字；没填或不是数字时返回 null */
export function parseAmount(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** 金额取到分：充值金额都按分计，避免出现半分 */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** 自定义充值金额：取到分后落在限额内才算有效，否则返回 null */
export function parseRechargeAmount(text: string): number | null {
  const value = parseAmount(text);
  if (value === null) return null;
  const cents = roundCents(value);
  return cents >= RECHARGE_LIMITS.min && cents <= RECHARGE_LIMITS.max ? cents : null;
}

/** 档位、限额这类整数金额写成 US$200、US$10,000（不带小数）；有小数时退回通用写法 */
export function formatUsdWhole(usd: number): string {
  return Number.isInteger(usd) ? `${USD_PREFIX}${formatInteger(usd)}` : formatUsd(usd);
}
