const numberFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const usdFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const secondsFormatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUsageNumber(value: number): string {
  return Number.isFinite(value) ? numberFormatter.format(value) : '—';
}

export function formatUsageUsd(value: number): string {
  return Number.isFinite(value) ? usdFormatter.format(value) : '—';
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
