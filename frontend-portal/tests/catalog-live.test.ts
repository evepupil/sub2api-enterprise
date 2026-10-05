import { describe, expect, it } from 'vitest';

import {
  buildSiteCatalog,
  DEFAULT_CHANNEL_GROUPS,
  EMPTY_SITE_CATALOG,
  filterSiteModels,
  groupSiteModels,
  parseChannelGroups,
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
    group(1, '共享通道', 0.15, [
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
    group(2, '专用通道', 0.3, [tokenModel('claude-sonnet-5-5', 2, 10)]),
    group(3, 'default', 1, [tokenModel('claude-sonnet-5-5', 2, 10)]),
  ],
};

const STATUS = {
  components: [
    {
      name: 'Claude-Sonnet-5-5',
      group_name: '共享通道',
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
const catalog = buildSiteCatalog(channels, status, DEFAULT_CHANNEL_GROUPS);
const shared = catalog.personal ?? [];
const find = (models: readonly SiteModel[], id: string) => {
  const found = models.find((model) => model.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('官网通道对应后台分组', () => {
  it('默认按同名对应，也可以用设置改', () => {
    expect(parseChannelGroups(undefined)).toEqual({ personal: '共享通道', pro: '专用通道' });
    expect(parseChannelGroups(' personal = 标准通道 , pro=高性能通道 ')).toEqual({
      personal: '标准通道',
      pro: '高性能通道',
    });
    expect(parseChannelGroups('enterprise=x,pro=,nonsense')).toEqual(DEFAULT_CHANNEL_GROUPS);
  });

  it('后台读不到时整体为空；没有对应分组的通道为空', () => {
    expect(buildSiteCatalog(null, status, DEFAULT_CHANNEL_GROUPS)).toEqual(EMPTY_SITE_CATALOG);
    const other = buildSiteCatalog(channels, null, { personal: '共享通道', pro: '不存在' });
    expect(other.personal).toHaveLength(3);
    expect(other.pro).toBeNull();
  });

  it('模型数取有数据的通道里最多的那个；都没有时为空', () => {
    expect(siteModelCount(catalog)).toBe(3);
    expect(siteModelCount(EMPTY_SITE_CATALOG)).toBeNull();
  });
});

describe('价格来自后台、乘分组倍率', () => {
  it('按 Token：输入输出与缓存读取都乘倍率，折扣 = 实付 ÷ 官方价', () => {
    const sonnet = find(shared, 'claude-sonnet-5-5');
    expect(sonnet.price).toMatchObject({ kind: 'token', input: 0.3, output: 1.5 });
    expect(sonnet.cacheRead).toBe(0.03);
    expect(sonnet.discount).toBe(0.15);
    expect(find(catalog.pro ?? [], 'claude-sonnet-5-5').price).toMatchObject({
      input: 0.6,
      output: 3,
    });
  });

  it('展示名、厂商、上下文取官网目录；目录里没有的显示原名', () => {
    const sonnet = find(shared, 'claude-sonnet-5-5');
    expect(sonnet.name).toBe('Claude Sonnet 5.5');
    expect(sonnet.provider).toBe('anthropic');
    expect(sonnet.contextTokens).not.toBeNull();
    const mystery = find(shared, 'mystery-model');
    expect(mystery).toMatchObject({ name: 'mystery-model', provider: null, released: null });
  });

  it('按张：取最低一档并标「起」', () => {
    expect(find(shared, 'gpt-image-2').price).toEqual({
      kind: 'request',
      unit: 'image',
      price: 0.006,
      from: true,
    });
  });
});

describe('可用率来自渠道监测', () => {
  it('按「分组标签 + 监测项名称」对上模型（不分大小写），状态折成四档', () => {
    expect(find(shared, 'claude-sonnet-5-5').health).toEqual({
      latencyMs: 1320,
      pingMs: 4,
      availability: 99.31,
      probes: ['up', 'slow', 'down', 'unknown'],
    });
  });

  it('没建监测项或分组标签对不上的模型没有可用率', () => {
    expect(find(shared, 'mystery-model').health).toBeNull();
    expect(find(shared, 'gpt-image-2').health).toBeNull();
    expect(find(catalog.pro ?? [], 'claude-sonnet-5-5').health).toBeNull();
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
    sort: 'latest',
    ...patch,
  });
  const ids = (models: readonly SiteModel[]) => models.map((model) => model.id);

  it('最新：目录里没有上线日期的排在最后', () => {
    expect(ids(filterSiteModels(shared, query())).at(-1)).toBe('mystery-model');
  });

  it('价格从低到高：文本在前、生图在后', () => {
    expect(ids(filterSiteModels(shared, query({ sort: 'price-asc' })))).toEqual([
      'mystery-model',
      'claude-sonnet-5-5',
      'gpt-image-2',
    ]);
  });

  it('类型、厂商、上下文、关键词', () => {
    expect(ids(filterSiteModels(shared, query({ type: 'image' })))).toEqual(['gpt-image-2']);
    expect(ids(filterSiteModels(shared, query({ providers: ['anthropic'] })))).toEqual([
      'claude-sonnet-5-5',
    ]);
    expect(ids(filterSiteModels(shared, query({ context: '200k' })))).not.toContain(
      'mystery-model',
    );
    expect(ids(filterSiteModels(shared, query({ query: 'MYSTERY' })))).toEqual(['mystery-model']);
  });

  it('筛选栏数量与厂商选项只算出现过的', () => {
    const counts = siteFacetCounts(shared, 'text');
    expect(counts.types).toEqual({ all: 3, text: 2, image: 1 });
    expect(counts.providers).toEqual({ anthropic: 1 });
    expect(providersOf(shared)).toEqual(['openai', 'anthropic']);
  });

  it('价目表按厂商分段，认不出厂商的放最后', () => {
    expect(groupSiteModels(shared).map((section) => section.provider)).toEqual([
      'openai',
      'anthropic',
      null,
    ]);
  });
});
