import type { PriceRange } from '../public/types';

function formatAmount(value: number): string {
  if (value === 0) {
    return '0.00';
  }

  const precise = value.toPrecision(10);
  const normalized = precise.includes('e')
    ? precise.replace(/(\.\d*?[1-9])0+(e[+-]?\d+)$/, '$1$2').replace(/\.0+(e[+-]?\d+)$/, '$1')
    : precise.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');

  if (normalized.includes('e')) {
    return normalized;
  }

  const decimalIndex = normalized.indexOf('.');
  const fractionDigits = decimalIndex === -1 ? 0 : normalized.length - decimalIndex - 1;
  if (fractionDigits >= 2) {
    return normalized;
  }
  return decimalIndex === -1
    ? `${normalized}.${'0'.repeat(2 - fractionDigits)}`
    : `${normalized}${'0'.repeat(2 - fractionDigits)}`;
}

export function formatPrice(value: PriceRange | null): string {
  if (value === null) {
    return '—';
  }

  const minimum = `$${formatAmount(value.min)}`;
  if (value.min === value.max) {
    return minimum;
  }
  return `${minimum} - $${formatAmount(value.max)}`;
}
