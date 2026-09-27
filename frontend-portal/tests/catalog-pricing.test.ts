/**
 * M1 匿名模型目录四价独立测试（Vitest，Node 环境）。
 *
 * 契约来源：design/public-site.md §2/§3、design/catalog.md、M1 测试任务书。
 * 只断言业务事实：parseCatalog 的价格区间、可见性过滤、分时倍率与 formatPrice 文本；
 * 不对 UI、className、组件渲染或整个实现映射做快照。
 *
 * 基础夹具（tests/fixtures/catalog.ts）：
 *   标准/非专属/rate_multiplier=0.5，模型 gpt-test（openai，token）。
 *   实收价期待 input 1.5 / output 7.5 / cacheWrite null / cacheRead 0（美元每百万）。
 *
 * 独立核对源：frontend/src/utils/pricing.ts（resolveIntervalPrices 的绝对价优先、
 * cache_write_1h 回退与 formatScaled 的浮点处理），仅用于校准语义，不照抄实现。
 */
import { describe, expect, it } from 'vitest';

import { formatPrice } from '../src/features/catalog/format';
import { parseCatalog } from '../src/features/catalog/adapter';
import type { CatalogData, PriceKey, PriceRange } from '../src/features/public/types';
import {
  appendGroup,
  baseCatalog,
  groupAt,
  modelAt,
  pricingOf,
  type Json,
  type JsonObject,
} from './fixtures/catalog';

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function parse(value: unknown): CatalogData {
  return parseCatalog(value);
}

function modelCount(value: unknown): number {
  return parse(value).models.length;
}

function pricesOf(value: unknown, index = 0) {
  const model = parse(value).models[index];
  expect(model, `models[${index}] 应存在`).toBeDefined();
  return model!.prices;
}

function priceOf(value: unknown, key: PriceKey, index = 0): PriceRange | null {
  return pricesOf(value, index)[key];
}

function withGroupRate(catalog: JsonObject, rate: Json): JsonObject {
  groupAt(catalog).rate_multiplier = rate;
  return catalog;
}

function withPricing(catalog: JsonObject, pricing: Json): JsonObject {
  modelAt(catalog).pricing = pricing;
  return catalog;
}

/** 把基础模型的 pricing 与分组倍率重置为 rate=1、给定四价与 intervals。 */
function tokenModel(overrides: JsonObject = {}): JsonObject {
  const catalog = baseCatalog();
  withGroupRate(catalog, 1);
  withPricing(catalog, {
    billing_mode: 'token',
    input_price: 3e-6,
    output_price: 15e-6,
    cache_write_price: null,
    cache_read_price: 0,
    intervals: [],
    ...overrides,
  });
  return catalog;
}

// ---------------------------------------------------------------------------
// 基础契约：四价、倍率、参考价、个人倍率
// ---------------------------------------------------------------------------

describe('parseCatalog 基础四价', () => {
  it('标准组 rate_multiplier=0.5 换算为美元每百万，四价键齐备', () => {
    const prices = pricesOf(baseCatalog());
    expect(prices.input).toEqual({ min: 1.5, max: 1.5 });
    expect(prices.output).toEqual({ min: 7.5, max: 7.5 });
    expect(prices.cacheWrite).toBeNull();
    expect(prices.cacheRead).toEqual({ min: 0, max: 0 });
  });

  it('不把 official_pricing 当实售价（input 参考价 99 不出现）', () => {
    const input = priceOf(baseCatalog(), 'input');
    expect(input).toEqual({ min: 1.5, max: 1.5 });
    expect(input!.max).not.toBe(99);
  });

  it('匿名不采 user_rate_multiplier 私价，只用 rate_multiplier', () => {
    const catalog = baseCatalog();
    groupAt(catalog).user_rate_multiplier = 100;
    expect(priceOf(catalog, 'input')).toEqual({ min: 1.5, max: 1.5 });
    expect(priceOf(catalog, 'output')).toEqual({ min: 7.5, max: 7.5 });
  });

  it('倍率 0 合法：所有有效价变为 0 而非缺失', () => {
    const catalog = withGroupRate(baseCatalog(), 0);
    const prices = pricesOf(catalog);
    expect(prices.input).toEqual({ min: 0, max: 0 });
    expect(prices.output).toEqual({ min: 0, max: 0 });
    expect(prices.cacheRead).toEqual({ min: 0, max: 0 });
    // 缺价与 0 必须可区分：基础 cache_write_price 为 null，仍是 null。
    expect(prices.cacheWrite).toBeNull();
  });

  it('缺价保持 null，不猜默认', () => {
    const catalog = tokenModel({ input_price: null });
    delete pricingOf(catalog).output_price;
    expect(priceOf(catalog, 'input')).toBeNull();
    expect(priceOf(catalog, 'output')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 空 / 非法 pricing 与非 token 模式
// ---------------------------------------------------------------------------

describe('parseCatalog pricing 缺失与非 token 模式', () => {
  it('pricing 为 null：保留型号，四价全 null', () => {
    const catalog = baseCatalog();
    modelAt(catalog).pricing = null;
    const prices = pricesOf(catalog);
    expect(prices.input).toBeNull();
    expect(prices.output).toBeNull();
    expect(prices.cacheWrite).toBeNull();
    expect(prices.cacheRead).toBeNull();
    expect(modelCount(catalog)).toBe(1);
  });

  it('billing_mode=image 不按百万换算，四价全 null', () => {
    const catalog = tokenModel({ billing_mode: 'image' });
    const prices = pricesOf(catalog);
    expect(prices.input).toBeNull();
    expect(prices.output).toBeNull();
    expect(prices.cacheWrite).toBeNull();
    expect(prices.cacheRead).toBeNull();
  });

  it('billing_mode=per_request 不按百万换算，四价全 null', () => {
    const catalog = tokenModel({ billing_mode: 'per_request' });
    const prices = pricesOf(catalog);
    expect(prices.input).toBeNull();
    expect(prices.output).toBeNull();
    expect(prices.cacheWrite).toBeNull();
    expect(prices.cacheRead).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 可见性：专属组 / 订阅组不进入首版匿名目录
// ---------------------------------------------------------------------------

describe('parseCatalog 可见性过滤', () => {
  it('is_exclusive=true 的组不展示', () => {
    const catalog = baseCatalog();
    groupAt(catalog).is_exclusive = true;
    expect(parse(catalog).models).toEqual([]);
  });

  it("subscription_type='subscription' 的组不展示", () => {
    const catalog = baseCatalog();
    groupAt(catalog).subscription_type = 'subscription';
    expect(parse(catalog).models).toEqual([]);
  });

  it("subscription_type='' 视同标准组，正常展示", () => {
    const catalog = baseCatalog();
    groupAt(catalog).subscription_type = '';
    expect(priceOf(catalog, 'input')).toEqual({ min: 1.5, max: 1.5 });
  });

  it('专属组与订阅组被剔除，标准组仍保留', () => {
    const catalog = baseCatalog();
    appendGroup(catalog, { id: 2, is_exclusive: true });
    appendGroup(catalog, { id: 3, subscription_type: 'subscription' });
    expect(modelCount(catalog)).toBe(1);
    expect(priceOf(catalog, 'input')).toEqual({ min: 1.5, max: 1.5 });
  });
});

// ---------------------------------------------------------------------------
// 同型号多组聚合
// ---------------------------------------------------------------------------

describe('parseCatalog 同型号多标准组合并', () => {
  it('同型号去重为一张，min/max 覆盖所有标准组', () => {
    const catalog = baseCatalog();
    withGroupRate(catalog, 1);
    withPricing(catalog, {
      billing_mode: 'token',
      input_price: 2e-6,
      output_price: 15e-6,
      cache_write_price: null,
      cache_read_price: null,
      intervals: [],
    });
    const second = appendGroup(catalog, { id: 2 });
    second.rate_multiplier = 1;
    (second.models as JsonObject[])[0]!.pricing = {
      billing_mode: 'token',
      input_price: 4e-6,
      output_price: 15e-6,
      cache_write_price: null,
      cache_read_price: null,
      intervals: [],
    };

    const models = parse(catalog).models;
    expect(models.length).toBe(1);
    expect(models[0]!.id.length).toBeGreaterThan(0);
    expect(models[0]!.prices.input).toEqual({ min: 2, max: 4 });
  });

  it('缺失价格不参与聚合、不被算成 0', () => {
    const catalog = baseCatalog();
    withGroupRate(catalog, 1);
    withPricing(catalog, {
      billing_mode: 'token',
      input_price: null,
      output_price: null,
      cache_write_price: null,
      cache_read_price: null,
      intervals: [],
    });
    const second = appendGroup(catalog, { id: 2 });
    second.rate_multiplier = 1;
    (second.models as JsonObject[])[0]!.pricing = {
      billing_mode: 'token',
      input_price: 4e-6,
      output_price: null,
      cache_write_price: null,
      cache_read_price: null,
      intervals: [],
    };
    expect(priceOf(catalog, 'input')).toEqual({ min: 4, max: 4 });
  });
});

// ---------------------------------------------------------------------------
// 档位（intervals）：绝对价优先、base×multiplier 回退、cache 1h 合并
// ---------------------------------------------------------------------------

describe('parseCatalog 上下文档位', () => {
  it('档位绝对价优先；缺绝对价时回退 base×同维 multiplier', () => {
    const catalog = tokenModel({
      intervals: [
        {
          min_tokens: 0,
          max_tokens: 1000,
          input_price: 1e-6,
          output_price: null,
          cache_write_price: null,
          cache_read_price: null,
          // 绝对价存在时必须忽略该 multiplier。
          input_multiplier: 10,
          output_multiplier: 2,
        },
        {
          min_tokens: 1000,
          max_tokens: null,
          input_price: null,
          output_price: null,
          cache_write_price: null,
          cache_read_price: null,
          input_multiplier: 2,
          // output_multiplier 缺省按 1。
        },
      ],
    });
    // input: 绝对 1e-6，回退 3e-6×2=6e-6，base 3e-6 => [1,6]
    expect(priceOf(catalog, 'input')).toEqual({ min: 1, max: 6 });
    // output: 档位0 15e-6×2=3e-5，档位1 缺省×1=15e-6，base 15e-6 => [15,30]
    expect(priceOf(catalog, 'output')).toEqual({ min: 15, max: 30 });
  });

  it('cache 1h 合入 cacheWrite 区间，与 5m 一起取 min/max', () => {
    const catalog = tokenModel({
      intervals: [
        {
          min_tokens: 0,
          max_tokens: null,
          input_price: null,
          output_price: null,
          cache_write_price: 2e-6,
          cache_write_1h_price: 4e-6,
          cache_read_price: null,
        },
      ],
    });
    expect(priceOf(catalog, 'cacheWrite')).toEqual({ min: 2, max: 4 });
  });

  it('official_pricing 的档位不拿来兜底实售价', () => {
    const catalog = tokenModel({
      input_price: null,
      output_price: null,
      cache_write_price: null,
      cache_read_price: null,
    });
    modelAt(catalog).official_pricing = {
      input_price: 99,
      intervals: [
        {
          min_tokens: 0,
          max_tokens: null,
          input_price: 50e-6,
          output_price: 50e-6,
          cache_write_price: null,
          cache_read_price: null,
        },
      ],
    };
    const prices = pricesOf(catalog);
    expect(prices.input).toBeNull();
    expect(prices.output).toBeNull();
    expect(prices.cacheWrite).toBeNull();
    expect(prices.cacheRead).toBeNull();
  });

  it('intervals 缺失可容忍，按 base 计算', () => {
    const catalog = baseCatalog();
    withGroupRate(catalog, 1);
    const pricing = pricingOf(catalog);
    delete pricing.intervals;
    expect(priceOf(catalog, 'input')).toEqual({ min: 3, max: 3 });
    expect(priceOf(catalog, 'output')).toEqual({ min: 15, max: 15 });
  });

  it('intervals 错类型必须拒绝', () => {
    const catalog = tokenModel();
    pricingOf(catalog).intervals = 'not-an-array';
    expect(() => parse(catalog)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// max_reasoning_effort_multiplier（位于 pricing）
// ---------------------------------------------------------------------------

describe('parseCatalog max_reasoning_effort_multiplier', () => {
  it('有值时扩展各维最大，最低仍为基础价', () => {
    const catalog = tokenModel({ max_reasoning_effort_multiplier: 2 });
    expect(priceOf(catalog, 'input')).toEqual({ min: 3, max: 6 });
    expect(priceOf(catalog, 'output')).toEqual({ min: 15, max: 30 });
  });
});

// ---------------------------------------------------------------------------
// 分时倍率
// ---------------------------------------------------------------------------

describe('parseCatalog 分时倍率', () => {
  it('09:00-18:00 倍率 2 => 原价..2x', () => {
    const catalog = tokenModel();
    modelAt(catalog).time_pricing = {
      timezone: 'Asia/Shanghai',
      periods: [{ start_time: '09:00', end_time: '18:00', multiplier: 2 }],
    };
    expect(priceOf(catalog, 'input')).toEqual({ min: 3, max: 6 });
    expect(priceOf(catalog, 'output')).toEqual({ min: 15, max: 30 });
  });

  it('weekdays_only 全天倍率 2：周末仍按 1x，区间含原价', () => {
    const catalog = tokenModel();
    modelAt(catalog).time_pricing = {
      timezone: 'Asia/Shanghai',
      weekdays_only: true,
      periods: [{ start_time: '00:00', end_time: '24:00', multiplier: 2 }],
    };
    expect(priceOf(catalog, 'input')).toEqual({ min: 3, max: 6 });
  });

  it('非 weekdays 全天 00:00-24:00 倍率 2：只保留 2x', () => {
    const catalog = tokenModel();
    modelAt(catalog).time_pricing = {
      timezone: 'Asia/Shanghai',
      periods: [{ start_time: '00:00', end_time: '24:00', multiplier: 2 }],
    };
    expect(priceOf(catalog, 'input')).toEqual({ min: 6, max: 6 });
    expect(priceOf(catalog, 'output')).toEqual({ min: 30, max: 30 });
  });

  it('时间串支持 HH:mm:ss', () => {
    const catalog = tokenModel();
    modelAt(catalog).time_pricing = {
      timezone: 'Asia/Shanghai',
      periods: [{ start_time: '09:00:00', end_time: '18:00:00', multiplier: 2 }],
    };
    expect(priceOf(catalog, 'input')).toEqual({ min: 3, max: 6 });
  });

  it('非法时间串必须拒绝', () => {
    const catalog = tokenModel();
    modelAt(catalog).time_pricing = {
      timezone: 'Asia/Shanghai',
      periods: [{ start_time: '9:00', end_time: '18:00', multiplier: 2 }],
    };
    expect(() => parse(catalog)).toThrow();
  });

  it('真正倒序的时段（18:00 到 17:00）必须拒绝', () => {
    const catalog = tokenModel();
    modelAt(catalog).time_pricing = {
      timezone: 'Asia/Shanghai',
      periods: [{ start_time: '18:00', end_time: '17:00', multiplier: 2 }],
    };
    expect(() => parse(catalog)).toThrow();
  });

  it.each([
    ['无秒', '18:00', '00:00'],
    ['有秒', '18:00:00', '00:00:00'],
  ])(
    'end_time=00:00 视为次日 24:00（%s）：18:00 到 00:00 倍率 2 => base..2x，不抛错',
    (_label, start, end) => {
      const catalog = tokenModel();
      modelAt(catalog).time_pricing = {
        timezone: 'Asia/Shanghai',
        periods: [{ start_time: start, end_time: end, multiplier: 2 }],
      };
      expect(priceOf(catalog, 'input')).toEqual({ min: 3, max: 6 });
      expect(priceOf(catalog, 'output')).toEqual({ min: 15, max: 30 });
    },
  );

  it.each([
    ['无秒', '00:00', '00:00'],
    ['有秒', '00:00:00', '00:00:00'],
  ])(
    'end_time=00:00 视为次日 24:00（%s）：全天倍率 2 且非 weekdays => 仅 2x',
    (_label, start, end) => {
      const catalog = tokenModel();
      modelAt(catalog).time_pricing = {
        timezone: 'Asia/Shanghai',
        weekdays_only: false,
        periods: [{ start_time: start, end_time: end, multiplier: 2 }],
      };
      expect(priceOf(catalog, 'input')).toEqual({ min: 6, max: 6 });
      expect(priceOf(catalog, 'output')).toEqual({ min: 30, max: 30 });
    },
  );
});

// ---------------------------------------------------------------------------
// 非法数值与结构：一律抛错，不猜默认
// ---------------------------------------------------------------------------

describe('parseCatalog 非法输入', () => {
  it('groups 为空数组是合法空结果', () => {
    expect(parse({ groups: [] })).toEqual({ models: [] });
  });

  it.each([
    ['null 顶层', null],
    ['缺少 groups', {}],
    ['groups 非数组', { groups: 'x' }],
    ['group 非对象', { groups: [1] }],
    ['models 非数组', { groups: [{ ...groupAt(baseCatalog()), models: 'x' }] }],
  ])('%s 抛错', (_label, value) => {
    expect(() => parse(value)).toThrow();
  });

  it.each([
    ['rate_multiplier 为 NaN', Number.NaN],
    ['rate_multiplier 为负数', -1],
    ['rate_multiplier 为 Infinity', Number.POSITIVE_INFINITY],
    ['rate_multiplier 缺失', undefined],
  ])('%s 抛错，不猜默认', (_label, rate) => {
    const catalog = baseCatalog();
    if (rate === undefined) delete groupAt(catalog).rate_multiplier;
    else groupAt(catalog).rate_multiplier = rate as Json;
    expect(() => parse(catalog)).toThrow();
  });

  it.each([
    ['input_price 为 NaN', Number.NaN],
    ['input_price 为负数', -3e-6],
    ['input_price 为 Infinity', Number.POSITIVE_INFINITY],
  ])('%s 抛错', (_label, value) => {
    const catalog = tokenModel({ input_price: value as Json });
    expect(() => parse(catalog)).toThrow();
  });

  it('档位费率 NaN 抛错', () => {
    const catalog = tokenModel({
      intervals: [
        {
          min_tokens: 0,
          max_tokens: null,
          input_price: null,
          output_price: null,
          cache_write_price: null,
          cache_read_price: null,
          input_multiplier: Number.NaN,
        },
      ],
    });
    expect(() => parse(catalog)).toThrow();
  });

  it('pricing 为非法字符串抛错（null 才是空价）', () => {
    const catalog = baseCatalog();
    modelAt(catalog).pricing = 'broken';
    expect(() => parse(catalog)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 厂商识别
// ---------------------------------------------------------------------------

describe('parseCatalog 厂商识别', () => {
  function providerCatalog(names: string[]): JsonObject {
    const catalog = baseCatalog();
    const group = groupAt(catalog);
    group.platform = 'custom';
    group.models = names.map((name) => ({
      name,
      platform: 'custom',
      pricing: null,
      official_pricing: null,
    }));
    return catalog;
  }

  it.each([
    ['claude-3-5-sonnet', 'Anthropic'],
    ['gpt-4o', 'OpenAI'],
    ['gemini-1.5-pro', 'Google'],
  ])('%s 识别为 %s', (name, expected) => {
    const model = parse(providerCatalog([name])).models[0]!;
    expect(model.provider).toBe(expected);
    expect(model.providerKey).not.toBe('other');
  });

  it('未知厂商保留 platform 文字且 providerKey=other', () => {
    const model = parse(providerCatalog(['unknown-model-xyz'])).models[0]!;
    expect(model.provider).toBe('custom');
    expect(model.providerKey).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// 回归：同型号跨平台、代号保留、未知 billing_mode、溢出、折扣倍率
// ---------------------------------------------------------------------------

describe('parseCatalog 回归用例', () => {
  it('同型号不同 platform 保留两条，id 均为原模型代号，不附厂家后缀', () => {
    const catalog = baseCatalog();
    const first = groupAt(catalog);
    first.platform = 'custom-a';
    const firstModel = (first.models as JsonObject[])[0]!;
    firstModel.name = 'shared-model';
    firstModel.platform = 'custom-a';

    const second = appendGroup(catalog, { id: 2, platform: 'custom-b' });
    const secondModel = (second.models as JsonObject[])[0]!;
    secondModel.name = 'shared-model';
    secondModel.platform = 'custom-b';

    const models = parse(catalog).models;
    expect(models.length).toBe(2);
    expect(models.map((model) => model.id)).toEqual(['shared-model', 'shared-model']);
  });

  it('仅大小写不同的型号分别保留，不合并', () => {
    const catalog = baseCatalog();
    const first = groupAt(catalog);
    (first.models as JsonObject[])[0]!.name = 'Model-A';

    const second = appendGroup(catalog, { id: 2 });
    (second.models as JsonObject[])[0]!.name = 'model-a';

    const ids = parse(catalog)
      .models.map((model) => model.id)
      .sort();
    expect(ids).toEqual(['Model-A', 'model-a']);
  });

  it('未知 billing_mode（future_unit）不当作 token，四价全 null', () => {
    const catalog = tokenModel({ billing_mode: 'future_unit' });
    const prices = pricesOf(catalog);
    expect(prices.input).toBeNull();
    expect(prices.output).toBeNull();
    expect(prices.cacheWrite).toBeNull();
    expect(prices.cacheRead).toBeNull();
  });

  it('有限价 1e308 × 倍率 10 溢出应抛错，不出现 Infinity 报价', () => {
    const catalog = baseCatalog();
    withGroupRate(catalog, 10);
    pricingOf(catalog).input_price = 1e308;
    expect(() => parse(catalog)).toThrow();
  });

  it('max_reasoning_effort_multiplier=0.5 时区间含折扣最低价', () => {
    const catalog = tokenModel({ max_reasoning_effort_multiplier: 0.5 });
    expect(priceOf(catalog, 'input')).toEqual({ min: 1.5, max: 3 });
    expect(priceOf(catalog, 'output')).toEqual({ min: 7.5, max: 15 });
  });
});

// ---------------------------------------------------------------------------
// formatPrice
// ---------------------------------------------------------------------------

describe('formatPrice', () => {
  it('null 显示破折号 —', () => {
    expect(formatPrice(null)).toBe('—');
  });

  it('零显示 $0.00', () => {
    expect(formatPrice({ min: 0, max: 0 })).toBe('$0.00');
  });

  it('单价显示一位金额', () => {
    expect(formatPrice({ min: 1.25, max: 1.25 })).toBe('$1.25');
  });

  it('极小非零价不被截成 0', () => {
    const text = formatPrice({ min: 1e-6, max: 1e-6 });
    expect(text).not.toBe('$0.00');
    expect(text).not.toBe('$0');
    expect(text).toContain('$');
    expect(Number(text.replace('$', ''))).toBeCloseTo(1e-6, 12);
  });

  it('浮点噪声不冗长', () => {
    const text = formatPrice({ min: 0.1 + 0.2, max: 0.1 + 0.2 });
    expect(text).not.toContain('30000000000000004');
    expect(text.length).toBeLessThanOrEqual(6);
    expect(text).toMatch(/^\$0\.30?$/);
  });

  it('min≠max 显示区间且两端都含美元符号', () => {
    const text = formatPrice({ min: 1.5, max: 7.5 });
    expect(text.match(/\$/g)?.length).toBe(2);
    expect(text).toContain('1.5');
    expect(text).toContain('7.5');
  });
});
