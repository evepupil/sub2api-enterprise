import { describe, expect, it } from 'vitest';

import {
  formatAmount,
  formatContext,
  formatDiscount,
  formatMoney,
  imagePrice,
  isNewModel,
  MODELS,
  textPrice,
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
});

describe('折扣标', () => {
  it('实付是官方价的 15%、30% 时写 1.5折、3折，没有折扣不显示', () => {
    expect(formatDiscount(0.15, 'zh')).toBe('1.5折');
    expect(formatDiscount(0.3, 'zh')).toBe('3折');
    expect(formatDiscount(0.15, 'en')).toBe('85% off');
    expect(formatDiscount(0.3, 'en')).toBe('70% off');
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

  it('价格只写美元（充值 1 元 = 1 美元，不做人民币换算）', () => {
    expect(formatMoney(0.6)).toBe('$0.6');
    expect(formatMoney(3)).toBe('$3');
  });

  it('上下文长度', () => {
    expect(formatContext(1_050_000)).toBe('1.05M');
    expect(formatContext(1_000_000)).toBe('1M');
    expect(formatContext(200_000)).toBe('200K');
    expect(formatContext(256_000)).toBe('256K');
  });
});
