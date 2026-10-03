import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILTER,
  editionDiscount,
  facetCounts,
  filterModels,
  formatAmount,
  formatContext,
  formatDiscount,
  formatMoney,
  groupByProvider,
  imagePrice,
  isNewModel,
  MODELS,
  priceSortKey,
  textPrice,
  uptimeFor,
  type Model,
} from '@/lib/catalog';

const model = (id: string): Model => {
  const found = MODELS.find((m) => m.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('模型目录', () => {
  it('共 30 个模型：23 个文本、7 个生图，调用名不重复', () => {
    expect(MODELS).toHaveLength(30);
    expect(MODELS.filter((m) => m.type === 'text')).toHaveLength(23);
    expect(MODELS.filter((m) => m.type === 'image')).toHaveLength(7);
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(30);
  });

  it('文本模型都有官方价与上下文，生图模型都有图片价', () => {
    for (const m of MODELS) {
      if (m.type === 'text') {
        expect(m.official, m.id).not.toBeNull();
        expect(m.contextTokens, m.id).not.toBeNull();
      } else {
        expect(m.image, m.id).not.toBeNull();
      }
    }
  });

  it('近 30 天上线的 7 个模型带「新」标记', () => {
    expect(MODELS.filter(isNewModel).map((m) => m.id)).toEqual([
      'gpt-6-astra',
      'gpt-6-sol',
      'gpt-6-luna',
      'claude-fable-5-1',
      'claude-sonnet-5-5',
      'gpt-image-2.5-sunburst',
      'gpt-image-2.5-flare',
    ]);
  });
});

describe('通道价格 = 官方价 × 分组倍率', () => {
  it('Claude Sonnet 5.5（官方 2 / 10）：共享 0.3 / 1.5，专用 0.6 / 3，企业通道定制没有单价', () => {
    const m = model('claude-sonnet-5-5');
    expect(textPrice(m, 'personal')).toEqual({
      input: 0.3,
      output: 1.5,
      cacheRead: 0.03,
      longContext: null,
    });
    expect(textPrice(m, 'pro')).toEqual({
      input: 0.6,
      output: 3,
      cacheRead: 0.06,
      longContext: null,
    });
    expect(textPrice(m, 'enterprise')).toBeNull();
  });

  it('GPT-6 Astra 超长上下文档按同一倍率换算', () => {
    expect(textPrice(model('gpt-6-astra'), 'pro')?.longContext).toEqual({
      threshold: 272_000,
      input: 6,
      output: 22.5,
    });
  });

  it('按 Token 计费的生图模型给出估算每张价', () => {
    expect(imagePrice(model('gemini-3.1-flash-image'), 'personal')).toEqual({
      kind: 'per-token',
      perMTokens: 9,
      estimatedPerImage: 0.01161,
    });
    expect(imagePrice(model('gemini-3.1-flash-image'), 'enterprise')).toBeNull();
  });

  it('按张计费的生图模型逐档换算并给出起价', () => {
    expect(imagePrice(model('gemini-3-pro-image'), 'pro')).toEqual({
      kind: 'per-image',
      resolutions: [
        { label: '2K', price: 0.0402 },
        { label: '4K', price: 0.072 },
      ],
      from: 0.0402,
    });
  });

  it('文本模型没有图片价，生图模型没有文本价', () => {
    expect(imagePrice(model('gpt-6-sol'), 'personal')).toBeNull();
    expect(textPrice(model('gpt-image-2'), 'personal')).toBeNull();
  });

  it('定制通道排序按官方价', () => {
    expect(priceSortKey(model('claude-sonnet-5-5'), 'enterprise')).toBe(2);
    expect(priceSortKey(model('claude-sonnet-5-5'), 'pro')).toBe(0.6);
  });
});

describe('折扣标', () => {
  it('共享通道 1.5折、专用通道 3折，企业通道定制不显示', () => {
    expect(formatDiscount(editionDiscount('personal'), 'zh')).toBe('1.5折');
    expect(formatDiscount(editionDiscount('pro'), 'zh')).toBe('3折');
    expect(formatDiscount(editionDiscount('personal'), 'en')).toBe('85% off');
    expect(formatDiscount(editionDiscount('pro'), 'en')).toBe('70% off');
    expect(editionDiscount('enterprise')).toBeNull();
    expect(formatDiscount(null, 'zh')).toBeNull();
  });
});

describe('格式化', () => {
  it('金额去掉末尾 0，按大小保留小数', () => {
    expect(formatAmount(0.84)).toBe('0.84');
    expect(formatAmount(3.168)).toBe('3.17');
    expect(formatAmount(0.05031)).toBe('0.0503');
    expect(formatAmount(2)).toBe('2');
    expect(formatAmount(102.04)).toBe('102');
  });

  it('人民币按 7.1 换算', () => {
    expect(formatMoney(0.6, 'usd')).toBe('$0.6');
    expect(formatMoney(0.6, 'cny')).toBe('¥4.26');
    expect(formatMoney(3, 'cny')).toBe('¥21.3');
  });

  it('上下文长度', () => {
    expect(formatContext(1_050_000)).toBe('1.05M');
    expect(formatContext(1_000_000)).toBe('1M');
    expect(formatContext(200_000)).toBe('200K');
    expect(formatContext(256_000)).toBe('256K');
  });
});

describe('筛选与排序', () => {
  it('筛选栏数量', () => {
    const all = facetCounts(MODELS, 'all');
    expect(all.types).toEqual({ all: 30, text: 23, image: 7 });
    expect(all.providers).toEqual({
      openai: 10,
      anthropic: 6,
      google: 8,
      deepseek: 2,
      moonshot: 1,
      zhipu: 1,
      minimax: 1,
      qwen: 1,
    });
    expect(all.protocols).toEqual({
      'openai-chat': 23,
      'openai-responses': 7,
      'anthropic-messages': 12,
      gemini: 8,
      'openai-images': 7,
    });
    expect(facetCounts(MODELS, 'image').providers.google).toBe(4);
  });

  it('组合筛选', () => {
    const f = DEFAULT_FILTER;
    const count = (patch: Partial<typeof f>) =>
      filterModels(MODELS, { ...f, ...patch }, 'personal').length;
    expect(count({ type: 'text', providers: ['anthropic'] })).toBe(6);
    expect(count({ context: '1m' })).toBe(21);
    expect(count({ context: '200k' })).toBe(23);
    expect(count({ protocols: ['anthropic-messages'] })).toBe(12);
    expect(count({ query: 'gemini' })).toBe(8);
    expect(count({ query: 'nano' })).toBe(4);
    expect(count({ query: '不存在的模型' })).toBe(0);
  });

  it('默认按最新排序', () => {
    expect(
      filterModels(MODELS, DEFAULT_FILTER, 'personal')
        .slice(0, 5)
        .map((m) => m.id),
    ).toEqual(['claude-sonnet-5-5', 'gpt-6-luna', 'gpt-6-astra', 'gpt-6-sol', 'claude-fable-5-1']);
  });

  it('价格从低到高：最便宜 GPT-6 Luna，最贵 GPT-6 Astra（与 Claude Fable 5.1 同价按名字排）', () => {
    const ids = filterModels(
      MODELS,
      { ...DEFAULT_FILTER, type: 'text', sort: 'price-asc' },
      'personal',
    ).map((m) => m.id);
    expect(ids.slice(0, 3)).toEqual(['gpt-6-luna', 'gpt-5.6-luna', 'gemini-3.1-flash-lite']);
    expect(ids.slice(-2)).toEqual(['claude-fable-5-1', 'gpt-6-astra']);
  });

  it('价格排序时文本在前、生图在后', () => {
    const list = filterModels(MODELS, { ...DEFAULT_FILTER, sort: 'price-desc' }, 'personal');
    expect(list.slice(0, 23).every((m) => m.type === 'text')).toBe(true);
    expect(list.slice(23).every((m) => m.type === 'image')).toBe(true);
  });

  it('按上下文排序，1.05M 的模型在最前', () => {
    expect(
      filterModels(MODELS, { ...DEFAULT_FILTER, sort: 'context' }, 'personal')
        .slice(0, 3)
        .map((m) => m.id),
    ).toEqual(['gpt-5.6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra']);
  });

  it('价目表按厂商分段', () => {
    const text = groupByProvider(MODELS.filter((m) => m.type === 'text'));
    expect(text.map((g) => g.provider)).toEqual([
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'moonshot',
      'zhipu',
      'minimax',
      'qwen',
    ]);
    const image = groupByProvider(MODELS.filter((m) => m.type === 'image'));
    expect(image.map((g) => [g.provider, g.models.length])).toEqual([
      ['openai', 3],
      ['google', 4],
    ]);
  });
});

describe('可用率（固定种子）', () => {
  it('同一输入结果固定，24 个小时格', () => {
    const a = uptimeFor('claude-sonnet-5-5', 'personal');
    expect(a).toEqual(uptimeFor('claude-sonnet-5-5', 'personal'));
    expect(a.slots).toHaveLength(24);
    expect(a.percent).toBe(99.93);
    expect(uptimeFor('gpt-6-astra', 'personal').percent).toBe(99.62);
    expect(uptimeFor('gemini-3.1-flash-image', 'enterprise').percent).toBe(100);
  });
});
