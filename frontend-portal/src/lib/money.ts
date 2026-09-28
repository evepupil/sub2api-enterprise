/**
 * 控制台金额格式：美元、两位小数（2026-09-28 用户要求）。
 *
 * - 余额、冻结、消费、费用、额度与申请金额统一走这里，输出带 $ 符号，例如 $1,234.56、-$3.20。
 * - 不为零但四舍五入后会变成 $0.00 的小额（绝对值不足半分）显示「< $0.01」，负数显示「> -$0.01」，
 *   避免把小额消费误读为免费。
 * - 无效值显示「—」。模型单价（每百万 Token 的价格）与充值订单的支付币种金额不走这里。
 */
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const HALF_CENT = 0.005;

export function formatUsd(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  if (value === 0) {
    // 同时收拢 -0，避免显示成 -$0.00。
    return usdFormatter.format(0);
  }
  if (Math.abs(value) < HALF_CENT) {
    return value > 0 ? '< $0.01' : '> -$0.01';
  }
  return usdFormatter.format(value);
}

const usdCompactFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** 紧凑金额：绝对值不足 1000 时同 formatUsd；1000 起写成 $1.2K、$3.4M，用于环图中心等空间有限处。 */
export function formatUsdCompact(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return Math.abs(value) < 1000 ? formatUsd(value) : usdCompactFormatter.format(value);
}
