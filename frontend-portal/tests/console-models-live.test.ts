import { describe, expect, it } from 'vitest';

import { parseFavorites, toggleFavorite } from '@/lib/console/live/models-favorites';
import type { ConsoleChannel } from '@/lib/console/live/models-types';
import {
  allModelRows,
  catalogEntry,
  cnyPerUsd,
  filterRows,
  formatLiveMoney,
  inferProtocols,
  inferProvider,
  modelRows,
  providersIn,
  type ModelsQuery,
} from '@/lib/console/live/models-view';
import { rechargeMultiplierFrom, toConsoleChannels } from '@/lib/server/sub2api/model-plaza';

/** 后端模型广场的一段真实形状（单价是美元 / 每 Token） */
const PLAZA = {
  description: '',
  groups: [
    {
      id: 2,
      name: '标准通道',
      platform: 'openai',
      rate_multiplier: 0.15,
      user_rate_multiplier: null,
      peak_rate_enabled: false,
      image_rate_independent: true,
      image_rate_multiplier: 0.5,
      long_context_pricing_enabled: true,
      models: [
        {
          name: 'gpt-5.5',
          platform: 'openai',
          pricing: {
            billing_mode: 'token',
            input_price: 5e-6,
            output_price: 3e-5,
            intervals: [
              { min_tokens: 0, max_tokens: 272000, input_price: 5e-6, output_price: 3e-5 },
              {
                min_tokens: 272000,
                max_tokens: null,
                input_price: null,
                input_multiplier: 2,
                output_price: 4.5e-5,
              },
            ],
          },
          official_pricing: { input_price: 5e-6, output_price: 3e-5 },
        },
        {
          name: 'gpt-image-2',
          platform: 'openai',
          pricing: { billing_mode: 'image', per_request_price: 0.04, intervals: [] },
          official_pricing: { input_price: 5e-6, output_price: 1e-5 },
        },
        {
          name: 'mystery-model-x',
          platform: 'openai',
          pricing: { billing_mode: 'token', input_price: 1e-6, output_price: 2e-6 },
          official_pricing: null,
          time_pricing: {
            timezone: 'Asia/Shanghai',
            weekdays_only: true,
            periods: [{ start_time: '00:30:00', end_time: '08:30:00', multiplier: 0.5 }],
          },
        },
      ],
    },
    {
      id: 3,
      name: '高性能通道',
      platform: 'anthropic',
      rate_multiplier: 0.3,
      user_rate_multiplier: 0.25,
      peak_rate_enabled: true,
      peak_start: '20:00',
      peak_end: '23:00',
      peak_rate_multiplier: 1.5,
      image_rate_independent: false,
      image_rate_multiplier: 1,
      long_context_pricing_enabled: false,
      models: [
        {
          name: 'claude-sonnet-4-5',
          platform: 'anthropic',
          pricing: {
            billing_mode: 'token',
            input_price: 3e-6,
            output_price: 1.5e-5,
            intervals: [
              { min_tokens: 0, max_tokens: 200000, input_price: 3e-6, output_price: 1.5e-5 },
              { min_tokens: 200000, max_tokens: null, input_price: 6e-6, output_price: 2.25e-5 },
            ],
          },
          official_pricing: { input_price: 3e-6, output_price: 1.5e-5 },
        },
      ],
    },
    { id: 4, name: '空通道', rate_multiplier: 1, models: [] },
  ],
};

const channels = toConsoleChannels(PLAZA) as ConsoleChannel[];
const [standard, premium] = channels as [ConsoleChannel, ConsoleChannel];

describe('后端模型广场 → 通道', () => {
  it('沿用后端顺序，去掉没有模型的通道；专属倍率优先；高峰与生图独立倍率带上', () => {
    expect(channels.map((channel) => channel.name)).toEqual(['标准通道', '高性能通道']);
    expect(standard).toMatchObject({
      id: '2',
      rate: 0.15,
      imageRate: 0.5,
      longContext: true,
      peak: null,
    });
    expect(premium).toMatchObject({
      rate: 0.25,
      defaultRate: 0.3,
      imageRate: null,
      longContext: false,
    });
    expect(premium.peak).toEqual({ start: '20:00', end: '23:00', multiplier: 1.5 });
  });

  it('分档没给绝对价时按基础价 × 档位倍率算；按次的取单价；分时段写成 HH:MM', () => {
    const gpt = standard.models[0];
    expect(gpt?.tiers[1]).toMatchObject({ minTokens: 272000, input: 1e-5, output: 4.5e-5 });
    expect(standard.models[1]).toMatchObject({
      billing: 'image',
      perRequest: 0.04,
      perRequestTiered: false,
    });
    expect(standard.models[2]?.timePricing).toEqual({
      weekdaysOnly: true,
      windows: [{ start: '00:30', end: '08:30', multiplier: 0.5 }],
    });
  });

  it('看不懂的数据返回 null；充值比例读不到或不是正数时按 1', () => {
    expect(toConsoleChannels({ groups: 'x' })).toBeNull();
    expect(rechargeMultiplierFrom({ balance_recharge_multiplier: 0.14 })).toBe(0.14);
    expect(rechargeMultiplierFrom({ balance_recharge_multiplier: 0 })).toBe(1);
    expect(rechargeMultiplierFrom(null)).toBe(1);
  });
});

describe('模型行', () => {
  const rows = modelRows(standard);
  const byId = new Map(rows.map((row) => [row.id, row]));

  it('目录里有的模型用目录的展示名、厂商、上下文；没有的显示原名并推断厂商、协议', () => {
    const gpt = byId.get('gpt-5.5');
    expect(gpt?.name).toBe(catalogEntry('gpt-5.5')?.name);
    expect(gpt?.provider).toBe('openai');
    expect(gpt?.contextTokens).toBe(catalogEntry('gpt-5.5')?.contextTokens);
    const mystery = byId.get('mystery-model-x');
    expect(mystery).toMatchObject({ name: 'mystery-model-x', provider: null, contextTokens: null });
    expect(mystery?.protocols).toEqual(['openai-chat', 'openai-responses']);
    expect(inferProvider('claude-opus-9')).toBe('anthropic');
    expect(inferProvider('qwen3.6-max')).toBe('qwen');
    expect(inferProtocols('gemini-3-pro', 'antigravity', 'text')).toEqual(['gemini']);
  });

  it('实付价 = 单价 × 通道倍率（每百万 Token）；长上下文档只在通道开了分档计费时显示', () => {
    expect(byId.get('gpt-5.5')?.price).toEqual({
      kind: 'token',
      input: 0.75,
      output: 4.5,
      longContext: { threshold: 272000, input: 1.5, output: 6.75 },
    });
    const sonnet = modelRows(premium)[0];
    expect(sonnet?.price).toMatchObject({
      kind: 'token',
      input: 0.75,
      output: 3.75,
      longContext: null,
    });
  });

  it('折扣 = 实付 ÷ 官方；生图开了独立倍率时按生图倍率，按张计费不显示官方价和折扣', () => {
    expect(byId.get('gpt-5.5')).toMatchObject({
      discount: 0.15,
      official: { input: 5, output: 30 },
    });
    expect(byId.get('gpt-image-2')).toMatchObject({
      price: { kind: 'request', unit: 'image', price: 0.02, from: false },
      official: null,
      discount: null,
    });
    expect(byId.get('mystery-model-x')?.discount).toBeNull();
  });

  it('时段说明：通道高峰在前，模型分时段在后', () => {
    expect(modelRows(premium)[0]?.windows).toEqual([
      { start: '20:00', end: '23:00', multiplier: 1.5, kind: 'peak', weekdaysOnly: false },
    ]);
    expect(byId.get('mystery-model-x')?.windows).toEqual([
      { start: '00:30', end: '08:30', multiplier: 0.5, kind: 'time', weekdaysOnly: true },
    ]);
  });
});

describe('筛选与排序', () => {
  const rows = modelRows(standard);
  const query = (patch: Partial<ModelsQuery> = {}): ModelsQuery => ({
    type: 'all',
    provider: 'all',
    context: 'all',
    protocol: 'all',
    query: '',
    sort: 'latest',
    ...patch,
  });

  it('按类型、厂商、关键词筛；按上下文筛时上下文未知的不出现', () => {
    expect(filterRows(rows, query({ type: 'image' })).map((row) => row.id)).toEqual([
      'gpt-image-2',
    ]);
    expect(filterRows(rows, query({ provider: 'openai' })).map((row) => row.id)).not.toContain(
      'mystery-model-x',
    );
    expect(filterRows(rows, query({ query: 'MYSTERY' })).map((row) => row.id)).toEqual([
      'mystery-model-x',
    ]);
    expect(filterRows(rows, query({ context: '200k' })).map((row) => row.id)).not.toContain(
      'mystery-model-x',
    );
  });

  it('按价格排序时没有价格的排最后；按最新排序时目录里没有的排最后', () => {
    const asc = filterRows(rows, query({ sort: 'price-asc' })).map((row) => row.id);
    expect(asc[0]).toBe('gpt-image-2');
    const latest = filterRows(rows, query({ sort: 'latest' })).map((row) => row.id);
    expect(latest.at(-1)).toBe('mystery-model-x');
  });

  it('厂商选项只列出现过的', () => {
    expect(providersIn(rows).map((provider) => provider.id)).toEqual(['openai']);
  });
});

describe('所有通道一张表', () => {
  // 第三个通道：和高性能通道挂同一个模型、倍率更高
  const premiumAgain: ConsoleChannel = {
    ...premium,
    id: '1',
    name: 'default',
    rate: 1,
    defaultRate: 1,
  };
  const rows = allModelRows([standard, premium, premiumAgain]);

  it('同一个模型在几个通道里就有几行，每行带通道名与倍率，键不重复', () => {
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((row) => row.key)).size).toBe(5);
    const sonnet = rows.filter((row) => row.id === 'claude-sonnet-4-5');
    expect(sonnet.map((row) => [row.channel.name, row.channel.rate])).toEqual([
      ['高性能通道', 0.25],
      ['default', 1],
    ]);
    expect(sonnet[1]?.price).toMatchObject({ input: 3, output: 15 });
  });

  it('同一个模型的几行挨着，倍率低的在前；关键词能搜通道名', () => {
    const query: ModelsQuery = {
      type: 'all',
      provider: 'all',
      context: 'all',
      protocol: 'all',
      query: '',
      sort: 'latest',
    };
    const sorted = filterRows(rows, query).filter((row) => row.id === 'claude-sonnet-4-5');
    expect(sorted.map((row) => row.channel.rate)).toEqual([0.25, 1]);
    expect(
      filterRows(rows, { ...query, query: '标准' }).every((row) => row.channel.id === '2'),
    ).toBe(true);
  });
});

describe('币种与收藏', () => {
  it('人民币按充值比例换算：付 1 元到账 1 美元时数字不变', () => {
    expect(formatLiveMoney(4.5, 'usd', 1)).toBe('$4.5');
    expect(formatLiveMoney(4.5, 'cny', 1)).toBe('¥4.5');
    expect(formatLiveMoney(0.7, 'cny', 0.14)).toBe('¥5');
    expect(cnyPerUsd(0.14)).toBe(7.14);
  });

  it('收藏：格式不对当作没有，点一下加上、再点去掉', () => {
    expect(parseFavorites('not json')).toEqual([]);
    expect(parseFavorites('["a",1,"b"]')).toEqual(['a', 'b']);
    expect(toggleFavorite(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleFavorite(['a', 'b'], 'a')).toEqual(['b']);
  });
});
