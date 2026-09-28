/**
 * 控制台统一金额格式行为测试（Vitest，Node 环境）。
 *
 * 契约来源：任务书「为控制台统一金额格式写行为测试」给出的行为描述——美元两位小数、
 * 千分位、负数带负号、零与 -0 统一显示 $0.00、四舍五入后会变成 $0.00 的小额显示
 * < $0.01 / > -$0.01、半分边界 0.005、无效值显示 —，以及 formatUsageUsd /
 * formatOrganizationMoney 委托给 formatUsd、formatQuotaAmount 的空配额文案。
 * 后续追加的任务书补了 formatUsdCompact（紧凑金额）的行为描述——绝对值不足 1000 时
 * 与 formatUsd 完全一致，1000 起写成带 $ 的紧凑形式（最多一位小数），无效值显示 —。
 * 按描述出题，不照抄 src/lib/money.ts 的实现反推用例。
 */
import { describe, expect, it } from 'vitest';

import { formatUsd, formatUsdCompact } from '../src/lib/money';
import { formatOrganizationMoney } from '../src/features/organization/format';
import { formatQuotaAmount, formatUsageUsd } from '../src/features/usage/usage-format';

describe('formatUsd', () => {
  describe('美元两位小数，带 $ 符号与千分位', () => {
    it.each<[number, string]>([
      [1234.56, '$1,234.56'],
      [1234567.891, '$1,234,567.89'],
      [1.2345, '$1.23'],
      [3.2, '$3.20'],
    ])('%s -> %s', (value, expected) => {
      expect(formatUsd(value)).toBe(expected);
    });
  });

  it('负数带负号：-3.2 -> -$3.20', () => {
    expect(formatUsd(-3.2)).toBe('-$3.20');
  });

  describe('零值统一显示 $0.00', () => {
    it('0 -> $0.00', () => {
      expect(formatUsd(0)).toBe('$0.00');
    });

    it('-0 -> $0.00，不出现 -$0.00', () => {
      const text = formatUsd(-0);
      expect(text).toBe('$0.00');
      expect(text).not.toBe('-$0.00');
    });
  });

  describe('四舍五入后会变成 $0.00 的小额（绝对值小于 0.005）', () => {
    it.each<[number, string]>([
      [0.004, '< $0.01'],
      [0.0001, '< $0.01'],
      [-0.004, '> -$0.01'],
    ])('%s -> %s', (value, expected) => {
      expect(formatUsd(value)).toBe(expected);
    });
  });

  describe('半分边界', () => {
    it('恰好 0.005 -> $0.01', () => {
      expect(formatUsd(0.005)).toBe('$0.01');
    });

    it('0.01 -> $0.01', () => {
      expect(formatUsd(0.01)).toBe('$0.01');
    });
  });

  describe('无效值统一显示 —', () => {
    it.each<[number | null | undefined, string]>([
      [Number.NaN, '—'],
      [Number.POSITIVE_INFINITY, '—'],
      [Number.NEGATIVE_INFINITY, '—'],
      [null, '—'],
      [undefined, '—'],
    ])('%s -> %s', (value, expected) => {
      expect(formatUsd(value)).toBe(expected);
    });
  });
});

describe('formatUsdCompact', () => {
  describe('绝对值不足 1000 时与 formatUsd 完全一致', () => {
    it.each<[number, string]>([
      [999.994, '$999.99'],
      [12.5, '$12.50'],
      [0.004, '< $0.01'],
      [0, '$0.00'],
      [-3.2, '-$3.20'],
    ])('%s -> %s', (value, expected) => {
      expect(formatUsdCompact(value)).toBe(expected);
      expect(formatUsdCompact(value)).toBe(formatUsd(value));
    });
  });

  describe('1000 起写成带 $ 的紧凑形式，最多一位小数', () => {
    it.each<[number, string]>([
      [1000, '$1K'],
      [1234, '$1.2K'],
      [1250000, '$1.3M'],
      [-4321, '-$4.3K'],
    ])('%s -> %s', (value, expected) => {
      expect(formatUsdCompact(value)).toBe(expected);
    });
  });

  describe('无效值统一显示 —', () => {
    it.each<[number | null | undefined, string]>([
      [Number.NaN, '—'],
      [Number.POSITIVE_INFINITY, '—'],
      [null, '—'],
      [undefined, '—'],
    ])('%s -> %s', (value, expected) => {
      expect(formatUsdCompact(value)).toBe(expected);
    });
  });
});

describe('formatUsageUsd 与 formatOrganizationMoney 委托给 formatUsd', () => {
  const sharedInputs: number[] = [
    1234.56,
    1234567.891,
    1.2345,
    3.2,
    -3.2,
    0,
    -0,
    0.004,
    -0.004,
    0.0001,
    0.005,
    0.01,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];

  it.each(sharedInputs)('formatUsageUsd(%s) 与 formatUsd 结果一致', (value) => {
    expect(formatUsageUsd(value)).toBe(formatUsd(value));
  });

  it.each(sharedInputs)('formatOrganizationMoney(%s) 与 formatUsd 结果一致', (value) => {
    expect(formatOrganizationMoney(value)).toBe(formatUsd(value));
  });

  it('formatOrganizationMoney 对 null / undefined 与 formatUsd 结果一致', () => {
    expect(formatOrganizationMoney(null)).toBe(formatUsd(null));
    expect(formatOrganizationMoney(undefined)).toBe(formatUsd(undefined));
  });
});

describe('formatQuotaAmount', () => {
  it('null 显示 不限', () => {
    expect(formatQuotaAmount(null)).toBe('不限');
  });

  it('12.5 显示 $12.50', () => {
    expect(formatQuotaAmount(12.5)).toBe('$12.50');
  });
});
