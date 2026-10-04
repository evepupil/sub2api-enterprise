/**
 * 充值弹窗的占位配置。账单页的余额、兑换码与交易记录已经接后端（见 live/billing-*）；
 * 充值还没接真实支付（用户 2026-10-04 确认），档位、赠送、限额与支付方式先写在这里，
 * 以后照 sub2api 原来的支付流程换成后端的支付配置。
 */

export type PaymentMethod = 'alipay' | 'wechat' | 'stripe';
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['alipay', 'wechat', 'stripe'];

const round2 = (x: number) => Math.round(x * 100) / 100;

/** 充值档位（美元） */
export const RECHARGE_PRESETS: readonly number[] = [10, 50, 100, 500];

/** 充值赠送（占位）：满 US$200 送 5%，满 US$500 送 10% */
export const RECHARGE_BONUS_TIERS: readonly { minUsd: number; rate: number }[] = [
  { minUsd: 500, rate: 0.1 },
  { minUsd: 200, rate: 0.05 },
];

export function rechargeBonus(amountUsd: number): number {
  const tier = RECHARGE_BONUS_TIERS.find((t) => amountUsd >= t.minUsd);
  return tier ? round2(amountUsd * tier.rate) : 0;
}

/** 充值金额限制（美元） */
export const RECHARGE_LIMITS = { min: 5, max: 10_000 };
