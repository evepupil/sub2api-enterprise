import { describe, expect, it } from 'vitest';

import {
  buildSiteCatalog,
  cheapestPerModel,
  distinctModelCount,
  filterSiteModels,
  groupSiteModels,
  priceRowId,
  providersOf,
  siteFacetCounts,
  siteModelCount,
  type SiteModel,
  type SiteModelsQuery,
} from '@/lib/catalog/live';
import { toConsoleChannels } from '@/lib/server/sub2api/model-plaza';
import { toStatusEntries } from '@/lib/server/sub2api/public-status';

/** 后端模型广场的一个分组（只写用得到的字段） */
const group = (id: number, name: string, rate: number, models: unknown[]) => ({
  id,
  name,
  rate_multiplier: rate,
  long_context_pricing_enabled: false,
  models,
});

const tokenModel = (name: string, input: number, output: number, extra: object = {}) => ({
  name,
  platform: 'anthropic',
  pricing: {
    billing_mode: 'token',
    input_price: input / 1_000_000,
    output_price: output / 1_000_000,
    cache_read_price: 0.2 / 1_000_000,
    ...extra,
  },
  official_pricing: { input_price: input / 1_000_000, output_price: output / 1_000_000 },
});

const PLAZA = {
  groups: [
    group(1, '共享 Claude', 0.15, [
      tokenModel('claude-sonnet-5-5', 2, 10),
      tokenModel('mystery-model', 1, 4),
      {
        name: 'gpt-image-2',
        platform: 'openai',
        pricing: {
          billing_mode: 'image',
          intervals: [{ per_request_price: 0.04 }, { per_request_price: 0.08 }],
        },
      },
    ]),
    group(2, '专用 Claude', 0.3, [tokenModel('claude-sonnet-5-5', 2, 10)]),
    group(3, 'default', 1, [tokenModel('claude-sonnet-5-5', 2, 10)]),
  ],
};

const STATUS = {
  components: [
    {
      name: 'Claude-Sonnet-5-5',
      group_name: '共享 claude',
      status: 'operational',
      availability_7d: 99.31,
      latency_ms: 1320,
      ping_latency_ms: 4,
      timeline: [
        { status: 'operational', checked_at: '2026-10-05T00:00:00Z' },
        { status: 'degraded', checked_at: '2026-10-05T00:01:00Z' },
        { status: 'outage', checked_at: '2026-10-05T00:02:00Z' },
        { status: 'weird', checked_at: '2026-10-05T00:03:00Z' },
      ],
    },
    { name: 'gpt-image-2', group_name: '别的分组', status: 'operational', availability_7d: 100 },
  ],
};

const channels = toConsoleChannels(PLAZA);
const status = toStatusEntries(STATUS);
const catalog = buildSiteCatalog(channels, status) ?? [];
const find = (id: string, groupName: string): SiteModel => {
  const found = catalog.find((model) => model.id === id && model.group.name === groupName);
  if (!found) throw new Error(`${groupName}:${id}`);
  return found;
};
const SONNET = 'claude-sonnet-5-5';

describe('官网按分组展示', () => {
  it('每个分组里的每个模型一条，顺序同后台；同一个模型在几个分组里就有几条', () => {
    expect(catalog.map((model) => `${model.group.name}:${model.id}`)).toEqual([
      `共享 Claude:${SONNET}`,
      '共享 Claude:mystery-model',
      '共享 Claude:gpt-image-2',
      `专用 Claude:${SONNET}`,
      `default:${SONNET}`,
    ]);
    expect(new Set(catalog.map((model) => model.key)).size).toBe(catalog.length);
  });

  it('后台读不到时为空；模型数按不重复的模型算', () => {
    expect(buildSiteCatalog(null, status)).toBeNull();
    expect(siteModelCount(catalog)).toBe(3);
    expect(distinctModelCount(catalog)).toBe(3);
    expect(siteModelCount(null)).toBeNull();
    expect(siteModelCount([])).toBeNull();
  });
});

describe('价格来自后台、乘各自分组的倍率', () => {
  it('按 Token：输入输出与缓存读取都乘倍率，分组带着自己的倍率（分组名旁写 ×0.15）', () => {
    const shared = find(SONNET, '共享 Claude');
    expect(shared.price).toMatchObject({ kind: 'token', input: 0.3, output: 1.5 });
    expect(shared.cacheRead).toBe(0.03);
    expect(shared.group.rate).toBe(0.15);
    expect(find(SONNET, '专用 Claude').price).toMatchObject({ input: 0.6, output: 3 });
    expect(find(SONNET, '专用 Claude').group.rate).toBe(0.3);
    // 倍率 1 即官方价，同样写出来
    expect(find(SONNET, 'default').group.rate).toBe(1);
  });

  it('展示名、厂商、上下文取官网目录；目录里没有的显示原名', () => {
    const sonnet = find(SONNET, '共享 Claude');
    expect(sonnet.name).toBe('Claude Sonnet 5.5');
    expect(sonnet.provider).toBe('anthropic');
    expect(sonnet.contextTokens).not.toBeNull();
    expect(find('mystery-model', '共享 Claude')).toMatchObject({
      name: 'mystery-model',
      provider: null,
    });
  });

  it('按张：取最低一档并标「起」', () => {
    expect(find('gpt-image-2', '共享 Claude').price).toEqual({
      kind: 'request',
      unit: 'image',
      price: 0.006,
      from: true,
    });
  });
});

describe('可用率来自渠道监测', () => {
  it('按「分组标签 = 分组名、监测项名称 = 模型名」对上（不分大小写），状态折成四档', () => {
    expect(find(SONNET, '共享 Claude').health).toEqual({
      latencyMs: 1320,
      pingMs: 4,
      availability: 99.31,
      probes: ['up', 'slow', 'down', 'unknown'],
    });
  });

  it('没建监测项或分组标签对不上的没有可用率，别的分组的同一个模型也没有', () => {
    expect(find('mystery-model', '共享 Claude').health).toBeNull();
    expect(find('gpt-image-2', '共享 Claude').health).toBeNull();
    expect(find(SONNET, '专用 Claude').health).toBeNull();
  });

  it('对外服务状态看不懂时为空', () => {
    expect(toStatusEntries({ components: 'x' })).toBeNull();
    expect(toStatusEntries(null)).toBeNull();
    expect(toStatusEntries({ components: [{ name: ' ' }, { name: 'a' }] })).toEqual([
      { name: 'a', group: '', latencyMs: null, pingMs: null, availability: 0, probes: [] },
    ]);
  });
});

describe('模型页的筛选与排序', () => {
  const query = (patch: Partial<SiteModelsQuery> = {}): SiteModelsQuery => ({
    type: 'all',
    providers: [],
    context: 'all',
    query: '',
    sort: 'default',
    ...patch,
  });
  const labels = (models: readonly SiteModel[]) =>
    models.map((model) => `${model.group.name}:${model.id}`);

  it('默认：按后台模型广场里第一次出现的顺序，同一个模型的几条挨着、便宜的分组在前', () => {
    expect(labels(filterSiteModels(catalog, query()))).toEqual([
      `共享 Claude:${SONNET}`,
      `专用 Claude:${SONNET}`,
      `default:${SONNET}`,
      '共享 Claude:mystery-model',
      '共享 Claude:gpt-image-2',
    ]);
  });

  it('价格从低到高：文本在前、生图在后', () => {
    expect(labels(filterSiteModels(catalog, query({ sort: 'price-asc' })))).toEqual([
      '共享 Claude:mystery-model',
      `共享 Claude:${SONNET}`,
      `专用 Claude:${SONNET}`,
      `default:${SONNET}`,
      '共享 Claude:gpt-image-2',
    ]);
  });

  it('类型、厂商、上下文、关键词；关键词也搜分组名', () => {
    expect(labels(filterSiteModels(catalog, query({ type: 'image' })))).toEqual([
      '共享 Claude:gpt-image-2',
    ]);
    expect(filterSiteModels(catalog, query({ providers: ['anthropic'] }))).toHaveLength(3);
    expect(labels(filterSiteModels(catalog, query({ context: '200k' })))).not.toContain(
      '共享 Claude:mystery-model',
    );
    expect(labels(filterSiteModels(catalog, query({ query: 'MYSTERY' })))).toEqual([
      '共享 Claude:mystery-model',
    ]);
    expect(labels(filterSiteModels(catalog, query({ query: '专用' })))).toEqual([
      `专用 Claude:${SONNET}`,
    ]);
  });

  it('筛选栏数量按不重复的模型算，厂商选项只列出现过的', () => {
    const counts = siteFacetCounts(catalog, 'text');
    expect(counts.types).toEqual({ all: 3, text: 2, image: 1 });
    expect(counts.providers).toEqual({ anthropic: 1 });
    expect(providersOf(catalog)).toEqual(['openai', 'anthropic']);
  });
});

describe('价目表与首页', () => {
  it('价目表按厂商分段，认不出厂商的放最后；同一个模型的几个分组合成一项、便宜的在前', () => {
    const sections = groupSiteModels(catalog);
    expect(sections.map((section) => section.provider)).toEqual(['openai', 'anthropic', null]);
    const anthropic = sections.find((section) => section.provider === 'anthropic');
    expect(anthropic?.entries.map((entry) => entry.id)).toEqual([SONNET]);
    expect(anthropic?.entries[0]?.rows.map((model) => model.group.name)).toEqual([
      '共享 Claude',
      '专用 Claude',
      'default',
    ]);
  });

  it('模型卡跳到价目表里对应分组那一行', () => {
    expect(priceRowId(find(SONNET, '专用 Claude'))).toBe(`model-2-${SONNET}`);
  });

  it('首页每个模型一张卡、取最便宜的分组，别的分组更贵时标「起」', () => {
    const cards = cheapestPerModel(catalog);
    expect(cards.map((card) => `${card.model.group.name}:${card.model.id}`)).toHaveLength(3);
    const sonnet = cards.find((card) => card.model.id === SONNET);
    expect(sonnet?.model.group.name).toBe('共享 Claude');
    expect(sonnet?.from).toBe(true);
    expect(cards.find((card) => card.model.id === 'mystery-model')?.from).toBe(false);
    // 顺序同模型页「默认」：后台模型广场里第一次出现的顺序
    expect(cards.map((card) => card.model.id)).toEqual([SONNET, 'mystery-model', 'gpt-image-2']);
  });
});
