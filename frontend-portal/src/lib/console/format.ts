/**
 * 控制台的数字格式。金额一律美元（钱包按美元结算），前缀写 US$，和其他用「$」的币种区分开。
 */

/** 金额前缀：US$142.97 */
export const USD_PREFIX = 'US$';

/** 去掉小数末尾多余的 0（只处理带小数点的数字串，整数原样返回） */
const trim = (text: string) => (text.includes('.') ? text.replace(/\.?0+$/, '') : text);

/** 金额去掉小数末尾多余的 0，但至少留两位小数：0.5000 → 0.50，0.041200 → 0.0412 */
const trimToCents = (text: string) => text.replace(/(\.\d\d\d*?)0+$/, '$1');

const COMPACT_UNITS = [
  { base: 1e3, unit: 'K' },
  { base: 1e6, unit: 'M' },
  { base: 1e9, unit: 'B' },
] as const;

/** 紧凑数字：950 → 950，4970 → 4.97K，1_250_000 → 1.25M，3.4e9 → 3.4B */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs < 1000) return `${sign}${Math.round(abs)}`;
  let index: 0 | 1 | 2 = abs >= 1e9 ? 2 : abs >= 1e6 ? 1 : 0;
  const scaledText = (i: 0 | 1 | 2) => {
    const scaled = abs / COMPACT_UNITS[i].base;
    return scaled.toFixed(scaled >= 100 ? 1 : 2);
  };
  let text = scaledText(index);
  // 四舍五入进位到 1000 时换下一个单位（999,995 → 1M，而不是 1000K）
  if (Number(text) >= 1000 && index < 2) {
    index = index === 0 ? 1 : 2;
    text = scaledText(index);
  }
  return `${sign}${trim(text)}${COMPACT_UNITS[index].unit}`;
}

/** 千分位整数：2481920 → 2,481,920 */
export function formatInteger(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/**
 * 美元金额：≥ 1 保留两位小数加千分位（US$1,284.52）；
 * 0.01–1 保留四位（US$0.0412）；更小的保留六位（US$0.002117），都去掉末尾多余的 0，
 * 但至少留两位小数（US$0.50）。
 */
export function formatUsd(usd: number): string {
  const abs = Math.abs(usd);
  const sign = usd < 0 ? '-' : '';
  if (abs === 0) return `${USD_PREFIX}0.00`;
  if (abs >= 1) {
    return `${sign}${USD_PREFIX}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const fixed = abs.toFixed(abs >= 0.01 ? 4 : 6);
  // 六位小数也显示不出来的极小金额用科学计数，免得看成 0
  if (Number(fixed) === 0) return `${sign}${USD_PREFIX}${abs.toExponential(1)}`;
  return `${sign}${USD_PREFIX}${trimToCents(fixed)}`;
}

/** 带正负号的金额，流水用：+US$100.00 / -US$12.34 */
export function formatSignedUsd(usd: number): string {
  return usd > 0 ? `+${formatUsd(usd)}` : formatUsd(usd);
}

/** 耗时：820 ms / 3.54 s / 2.1 min */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${trim((ms / 1000).toFixed(2))} s`;
  return `${trim((ms / 60_000).toFixed(1))} min`;
}

/** 百分比：0.873 → 87.3%，1 → 100% */
export function formatPercent(ratio: number, digits = 1): string {
  return `${trim((ratio * 100).toFixed(digits))}%`;
}

/** 邮箱打码：zhangwei@gmail.com → z***@gmail.com */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 1) return email;
  return `${email[0]}***${email.slice(at)}`;
}
