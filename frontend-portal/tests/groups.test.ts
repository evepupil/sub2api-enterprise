import { describe, expect, it } from 'vitest';

import {
  defaultGroup,
  editionRatio,
  EDITIONS,
  GROUPS,
  groupsFor,
  PRIVILEGE_ROWS,
} from '@/lib/catalog';

describe('分组', () => {
  it('三个版本各四个分组，顺序：通用、生图、Claude 专线、第四张', () => {
    expect(GROUPS).toHaveLength(12);
    expect(groupsFor('personal').map((g) => g.kind)).toEqual([
      'general',
      'image',
      'claude',
      'priority',
    ]);
    expect(groupsFor('pro').map((g) => g.kind)).toEqual(['general', 'image', 'claude', 'priority']);
    expect(groupsFor('enterprise').map((g) => g.kind)).toEqual([
      'general',
      'image',
      'claude',
      'custom',
    ]);
  });

  it('倍率', () => {
    expect(groupsFor('personal').map((g) => g.ratio)).toEqual([1, 1, 1.2, 1.5]);
    expect(groupsFor('pro').map((g) => g.ratio)).toEqual([1.4, 1.3, 1.6, 2]);
    expect(groupsFor('enterprise').map((g) => g.ratio)).toEqual([2, 1.8, 2.2, null]);
  });

  it('每个版本恰好一张重点卡，定制分组走联系销售', () => {
    for (const e of EDITIONS) {
      expect(groupsFor(e.id).filter((g) => g.featured)).toHaveLength(1);
    }
    expect(GROUPS.find((g) => g.kind === 'custom')?.cta).toBe('contact');
  });

  it('版本价格取默认分组的倍率', () => {
    expect(defaultGroup('pro', 'text').kind).toBe('general');
    expect(defaultGroup('pro', 'image').kind).toBe('image');
    expect(editionRatio('personal', 'text')).toBe(1);
    expect(editionRatio('pro', 'text')).toBe(1.4);
    expect(editionRatio('enterprise', 'image')).toBe(1.8);
  });
});

describe('特权对比', () => {
  it('14 行，倍率与可用率从数据推出', () => {
    expect(PRIVILEGE_ROWS).toHaveLength(14);
    const row = (id: string) => PRIVILEGE_ROWS.find((r) => r.id === id)?.values;
    expect(row('general-ratio')).toEqual({
      personal: { zh: '×1.0', en: '×1.0' },
      pro: { zh: '×1.4', en: '×1.4' },
      enterprise: { zh: '×2.0', en: '×2.0' },
    });
    expect(row('sla')?.enterprise).toEqual({ zh: '99.9%', en: '99.9%' });
    expect(row('rpm')?.enterprise).toEqual({ zh: '3,000', en: '3,000' });
    expect(row('priority')).toEqual({ personal: false, pro: true, enterprise: true });
  });
});
