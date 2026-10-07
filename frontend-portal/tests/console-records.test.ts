import { describe, expect, it } from 'vitest';

import { API_KEYS, maskKey, rechargeBonus } from '@/lib/console';

describe('密钥', () => {
  it('打码保留前 9 位与末 4 位', () => {
    const key = API_KEYS[0]!;
    expect(maskKey(key.secret)).toBe(`${key.secret.slice(0, 9)}…${key.secret.slice(-4)}`);
    expect(key.secret.startsWith('sk-')).toBe(true);
  });
});

describe('充值弹窗', () => {
  it('充值赠送按档位从高到低取', () => {
    expect(rechargeBonus(100)).toBe(0);
    expect(rechargeBonus(200)).toBe(10);
    expect(rechargeBonus(500)).toBe(50);
  });
});
