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

  it('每张通道卡都有比上一档多出来的权益，清单里没有并发、限额这类数字', () => {
    for (const e of EDITIONS) {
      expect(GROUP_HIGHLIGHTS[e.id].length, e.id).toBeGreaterThan(0);
      for (const item of GROUP_HIGHLIGHTS[e.id]) {
        expect(item.zh, e.id).not.toMatch(/并发|每分钟|限额/);
      }
    }
    const zh = (id: 'personal' | 'pro' | 'enterprise') => GROUP_HIGHLIGHTS[id].map((i) => i.zh);
    expect(zh('personal')).toEqual([
      '全部文本模型',
      '全部生图模型',
      '7 天内可退款',
      '客服 24 小时在线',
      '基础安全防护',
    ]);
    expect(zh('pro')).toContain('ChatGPT 专业通道');
    expect(zh('enterprise')).toContain('可开发票');
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

describe('权益对比', () => {
  it('11 行，只比权益：不比倍率，不写可用率承诺，也不写并发、限额这类数字', () => {
    expect(PRIVILEGE_ROWS).toHaveLength(11);
    const ids = PRIVILEGE_ROWS.map((r) => r.id);
    for (const hidden of ['ratio', 'channel', 'sla', 'credits', 'rpm', 'concurrency', 'members']) {
      expect(ids).not.toContain(hidden);
    }
    const row = (id: string) => PRIVILEGE_ROWS.find((r) => r.id === id)?.values;
    expect(row('chatgpt-pro')).toEqual({ personal: false, pro: true, enterprise: true });
    expect(row('invoice')).toEqual({ personal: false, pro: false, enterprise: true });
    expect(row('security')?.enterprise).toEqual({ zh: '可定制', en: 'Custom' });
  });

  it('上一档有的权益下一档都有', () => {
    const order = ['personal', 'pro', 'enterprise'] as const;
    for (const row of PRIVILEGE_ROWS) {
      order.forEach((id, index) => {
        const next = order[index + 1];
        if (next && row.values[id] !== false) expect(row.values[next], row.id).not.toBe(false);
      });
    }
  });
});
