import { BALANCE_ALERT, formatInteger, formatUsd, RECHARGE_LIMITS } from '@/lib/console';

/** 余额提醒设置：和数据层初始值同一个形状 */
export type AlertSettings = typeof BALANCE_ALERT;

/** 提醒阈值允许的范围（美元） */
export const ALERT_THRESHOLD_LIMITS = { min: 0, max: 100_000 };

/**
 * 兑换成功后到账的金额。占位阶段没有后端，不论哪个兑换码都按 10 美元入账；
 * 接后端后改为按兑换码面额返回。
 */
export const REDEEM_AMOUNT_USD = 10;

/** 兑换码格式：用「-」连接的 2 到 5 段，每段至少两位大写字母或数字 */
const REDEEM_PATTERN = /^[A-Z0-9]{2,}(-[A-Z0-9]{2,}){1,4}$/;

export type RedeemCheck = { ok: true; code: string } | { ok: false; reason: 'required' | 'format' };

/** 校验兑换码：先去掉所有空白、转成大写，再判断是否为空和格式是否正确 */
export function checkRedeemCode(input: string): RedeemCheck {
  const code = input.replace(/\s+/g, '').toUpperCase();
  if (code === '') return { ok: false, reason: 'required' };
  return REDEEM_PATTERN.test(code) ? { ok: true, code } : { ok: false, reason: 'format' };
}

/** 数字输入框里的文字 → 数字；没填或不是数字时返回 null */
export function parseAmount(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** 金额取到分：进入流水的金额都按分计，避免余额里出现半分 */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isThresholdValid(value: number | null): value is number {
  return (
    value !== null && value >= ALERT_THRESHOLD_LIMITS.min && value <= ALERT_THRESHOLD_LIMITS.max
  );
}

/** 自定义充值金额：取到分后落在限额内才算有效，否则返回 null */
export function parseRechargeAmount(text: string): number | null {
  const value = parseAmount(text);
  if (value === null) return null;
  const cents = roundCents(value);
  return cents >= RECHARGE_LIMITS.min && cents <= RECHARGE_LIMITS.max ? cents : null;
}

/** Webhook 地址必须以 https:// 开头，并且带有主机名 */
export function isHttpsUrl(text: string): boolean {
  const value = text.trim();
  if (!/^https:\/\//i.test(value)) return false;
  try {
    return new URL(value).hostname !== '';
  } catch {
    return false;
  }
}

/** 档位、限额这类整数金额写成 $200、$10,000（不带小数）；有小数时退回通用写法 */
export function formatUsdWhole(usd: number): string {
  return Number.isInteger(usd) ? `$${formatInteger(usd)}` : formatUsd(usd);
}
