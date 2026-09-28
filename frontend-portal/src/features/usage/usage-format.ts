import { formatUsd } from '../../lib/money';

const numberFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const secondsFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsageNumber(value: number): string {
  return Number.isFinite(value) ? numberFormatter.format(value) : '—';
}

/** 金额：统一走 lib/money 的两位小数格式，自带 $ 符号，调用处不要再拼 $。 */
export function formatUsageUsd(value: number): string {
  return formatUsd(value);
}

export function formatUsageSeconds(milliseconds: number): string {
  return Number.isFinite(milliseconds) ? `${secondsFormatter.format(milliseconds / 1000)} 秒` : '—';
}

export function formatUsageDateLabel(value: string): string {
  if (value.length <= 16) return value;
  return value.replace('T', ' ').replace(/:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/u, '');
}

export function formatQuotaAmount(value: number | null): string {
  return value === null ? '不限' : formatUsageUsd(value);
}
