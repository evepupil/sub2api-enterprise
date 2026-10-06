import { describe, expect, it } from 'vitest';

import {
  EDITIONS,
  editionRatio,
  formatRatio,
  GROUP_HIGHLIGHTS,
  PRIVILEGE_ROWS,
  ratioLabel,
} from '@/lib/catalog';

describe('通道（一个通道就是一个分组）', () => {
  it('三种通道的顺序、名字与倍率：共享 ×0.15、专用 ×0.3、企业定制', () => {
    expect(EDITIONS.map((e) => e.id)).toEqual(['personal', 'pro', 'enterprise']);
    expect(EDITIONS.map((e) => e.name.zh)).toEqual(['共享通道', '专用通道', '企业通道']);
    expect(EDITIONS.map((e) => e.name.en)).toEqual(['Shared', 'Dedicated', 'Enterprise']);
    expect(EDITIONS.map((e) => e.ratio)).toEqual([0.15, 0.3, null]);
    expect(editionRatio('pro')).toBe(0.3);
    expect(editionRatio('enterprise')).toBeNull();
  });

  it('专用通道是唯一的重点卡，共享与专用查看定价，只有企业通道走联系客服', () => {
    expect(EDITIONS.filter((e) => e.featured).map((e) => e.id)).toEqual(['pro']);
    expect(EDITIONS.map((e) => e.cta)).toEqual(['pricing', 'pricing', 'contact']);
  });

  it('每张通道卡都有独有特权', () => {
    for (const e of EDITIONS) {
      expect(GROUP_HIGHLIGHTS[e.id].length, e.id).toBeGreaterThan(0);
    }
  });
});

describe('倍率写法（价格换算与控制台用）', () => {
  it('小数原样，整数补一位小数，定制显示文字', () => {
    expect(ratioLabel(0.15)).toBe('×0.15');
    expect(ratioLabel(0.3)).toBe('×0.3');
    expect(ratioLabel(1)).toBe('×1.0');
    expect(formatRatio(0.15, 'zh')).toBe('×0.15');
    expect(formatRatio(null, 'zh')).toBe('定制');
    expect(formatRatio(null, 'en')).toBe('Custom');
  });
});

describe('特权对比', () => {
  it('8 行，只比权益不比倍率，不写可用率承诺，额度从数据推出', () => {
    expect(PRIVILEGE_ROWS).toHaveLength(8);
    const ids = PRIVILEGE_ROWS.map((r) => r.id);
    for (const hidden of ['ratio', 'channel', 'sla', 'credits', 'invoice']) {
      expect(ids).not.toContain(hidden);
    }
    const row = (id: string) => PRIVILEGE_ROWS.find((r) => r.id === id)?.values;
    expect(row('rpm')?.enterprise).toEqual({ zh: '3,000', en: '3,000' });
    expect(row('priority')).toEqual({ personal: false, pro: true, enterprise: true });
    expect(row('support')?.enterprise).toEqual({ zh: '1 小时', en: '1 hour' });
  });
});
