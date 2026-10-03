import { describe, expect, it } from 'vitest';

import {
  EDITIONS,
  editionRatio,
  formatRatio,
  GROUP_HIGHLIGHTS,
  PRIVILEGE_ROWS,
  ratioLabel,
} from '@/lib/catalog';

describe('分组（一个版本就是一个分组）', () => {
  it('三个分组的顺序与倍率：个人版 ×0.15、专业版 ×0.3、企业版定制', () => {
    expect(EDITIONS.map((e) => e.id)).toEqual(['personal', 'pro', 'enterprise']);
    expect(EDITIONS.map((e) => e.ratio)).toEqual([0.15, 0.3, null]);
    expect(editionRatio('pro')).toBe(0.3);
    expect(editionRatio('enterprise')).toBeNull();
  });

  it('专业版是唯一的重点卡，只有企业版走联系销售', () => {
    expect(EDITIONS.filter((e) => e.featured).map((e) => e.id)).toEqual(['pro']);
    expect(EDITIONS.map((e) => e.cta)).toEqual(['register', 'register', 'contact']);
  });

  it('每个分组卡都有独有特权', () => {
    for (const e of EDITIONS) {
      expect(GROUP_HIGHLIGHTS[e.id].length, e.id).toBeGreaterThan(0);
    }
  });
});

describe('倍率写法', () => {
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
  it('13 行，倍率、可用率与额度从数据推出', () => {
    expect(PRIVILEGE_ROWS).toHaveLength(13);
    const row = (id: string) => PRIVILEGE_ROWS.find((r) => r.id === id)?.values;
    expect(row('ratio')).toEqual({
      personal: { zh: '×0.15', en: '×0.15' },
      pro: { zh: '×0.3', en: '×0.3' },
      enterprise: { zh: '定制', en: 'Custom' },
    });
    expect(row('sla')?.enterprise).toEqual({ zh: '99.9%', en: '99.9%' });
    expect(row('rpm')?.enterprise).toEqual({ zh: '3,000', en: '3,000' });
    expect(row('priority')).toEqual({ personal: false, pro: true, enterprise: true });
    expect(row('support')?.enterprise).toEqual({ zh: '1 小时', en: '1 hour' });
  });
});
