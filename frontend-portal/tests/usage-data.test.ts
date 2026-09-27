/**
 * M3 用量数据适配与请求层业务测试（Vitest，Node 环境）。
 *
 * 契约来源：.fleet/briefs/m23-usage-api.md、docs/模块设计/用量统计.md、
 * src/features/usage/types.ts。数据都是自己造的小而真实的例子，
 * 不复用实现里的任何常量。
 *
 * 只断言业务事实：
 * - fetchUsageOverview 并行取 /usage/stats 与 /usage/dashboard/snapshot-v2，
 *   两个请求共用同一 start_date / end_date / timezone / granularity；
 *   汇总与接口分布来自 stats，模型/分组/趋势来自 snapshot。
 * - 四类 Token 与 total、实际消费与标准消费彼此独立；stats 的
 *   account_cost / upstream_endpoints 不进返回。
 * - Go nil 数组（null）与合法空数组合法；缺失数字 / NaN / 负数一律抛异常，不补零。
 * - 明细只读 api_key.name，绝不把 api_key.key 带出；分页字段透传；
 *   total_tokens 缺失时按四类之和，缓存写入与缓存读取保持区分。
 * - 当前资金：普通组织成员只读 /usage/dashboard/stats 的 organization_quota，
 *   不请求 /user/profile；其余角色只读 /user/profile。
 *   quota.remaining 为 null 是后端明示的「不限额」；但 remaining 字段缺失
 *   必须报错，不能猜成不限。余额可以为负（后端允许欠费透支）。
 */
import { describe, expect, it } from 'vitest';

import {
  parseBalanceFunds,
  parseQuotaFunds,
  parseUsageOverview,
  parseUsageRecords,
} from '../src/features/usage/adapter';
import {
  fetchCurrentFunds,
  fetchUsageOverview,
  fetchUsageRecords,
} from '../src/features/usage/api';
import type { ApiRequestOptions, ApiRequester, PortalUser } from '../src/features/auth/types';
import type { DateRange, UsageFilters } from '../src/features/usage/types';

type Json = Record<string, unknown>;

const SH = 'Asia/Shanghai';
const RANGE: DateRange = { start: '2026-09-21', end: '2026-09-27', timeZone: SH };

interface Call {
  path: string;
  options: ApiRequestOptions | undefined;
}

/**
 * 可注入的 request spy：记录每次调用的 path 与 options，按基础路径返回夹具。
 * 出现未登记路径直接抛错，防止实现偷偷多发请求。
 */
function spyRequest(routes: Record<string, unknown>): { request: ApiRequester; calls: Call[] } {
  const calls: Call[] = [];
  const request = (async (path: string, options?: ApiRequestOptions): Promise<unknown> => {
    calls.push({ path, options });
    const base = path.split('?')[0] ?? path;
    if (!(base in routes)) {
      throw new Error(`测试未登记的请求路径：${path}`);
    }
    const value = routes[base];
    if (value instanceof Error) throw value;
    return value;
  }) as unknown as ApiRequester;
  return { request, calls };
}

function splitPath(path: string): { base: string; params: URLSearchParams } {
  const index = path.indexOf('?');
  const base = index === -1 ? path : path.slice(0, index);
  const params = new URLSearchParams(index === -1 ? '' : path.slice(index + 1));
  return { base, params };
}

function findCall(calls: Call[], base: string): { base: string; params: URLSearchParams } {
  const match = calls.find((call) => call.path.startsWith(`${base}?`));
  if (match === undefined) {
    throw new Error(`没有请求 ${base}，实际：${calls.map((c) => c.path).join(' | ')}`);
  }
  return splitPath(match.path);
}

// ---------------------------------------------------------------------------
// /usage/stats 与 /usage/dashboard/snapshot-v2 夹具
// ---------------------------------------------------------------------------

function statsPayload(overrides: Json = {}): Json {
  return {
    total_requests: 42,
    total_input_tokens: 1200,
    total_output_tokens: 800,
    total_cache_creation_tokens: 300,
    total_cache_read_tokens: 500,
    total_tokens: 2800,
    total_actual_cost: 1.25,
    total_cost: 2.5,
    average_duration_ms: 640.5,
    endpoints: [
      {
        endpoint: '/v1/chat/completions',
        requests: 30,
        total_tokens: 2000,
        actual_cost: 1,
        cost: 2,
      },
      { endpoint: '/v1/messages', requests: 12, total_tokens: 800, actual_cost: 0.25, cost: 0.5 },
    ],
    // 以下字段属于后端响应，但适配层不得读取。
    account_cost: 9.99,
    upstream_endpoints: [{ endpoint: '/upstream-only', requests: 999, total_tokens: 999999 }],
    ...overrides,
  };
}

function snapshotPayload(overrides: Json = {}): Json {
  return {
    generated_at: '2026-09-27T04:00:00Z',
    start_date: '2026-09-21',
    end_date: '2026-09-27',
    granularity: 'day',
    trend: [
      {
        date: '2026-09-26',
        requests: 20,
        input_tokens: 600,
        output_tokens: 400,
        cache_creation_tokens: 100,
        cache_read_tokens: 200,
        total_tokens: 1300,
        actual_cost: 0.6,
      },
      {
        date: '2026-09-27',
        requests: 22,
        input_tokens: 600,
        output_tokens: 400,
        cache_creation_tokens: 200,
        cache_read_tokens: 300,
        total_tokens: 1500,
        actual_cost: 0.65,
      },
    ],
    models: [
      {
        model: 'claude-sonnet-4',
        requests: 30,
        total_tokens: 2000,
        actual_cost: 1,
        cost: 2,
        input_tokens: 900,
      },
    ],
    groups: [
      { group_id: 7, group_name: '团队A', requests: 42, total_tokens: 2800, actual_cost: 1.25 },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// /usage 明细分页夹具
// ---------------------------------------------------------------------------

function recordPayload(overrides: Json = {}): Json {
  return {
    id: 101,
    created_at: '2026-09-27T02:15:30Z',
    model: 'claude-sonnet-4',
    api_key_id: 5,
    api_key: { id: 5, name: 'prod-key', key: 'sk-live-SECRET', user_id: 1 },
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_tokens: 30,
    cache_read_tokens: 20,
    total_tokens: 200,
    actual_cost: 0.12,
    total_cost: 0.24,
    duration_ms: 812,
    stream: true,
    ...overrides,
  };
}

function pagePayload(items: unknown[], overrides: Json = {}): Json {
  return { items, total: 43, page: 2, page_size: 20, pages: 3, ...overrides };
}

function memberUser(overrides: Partial<PortalUser> = {}): PortalUser {
  return {
    id: 9,
    email: 'member@example.com',
    username: 'member',
    balance: 0,
    frozenBalance: 0,
    role: 'user',
    organization: { id: 3, name: 'Acme', isOwner: false, status: 'active' },
    ...overrides,
  };
}

// ===========================================================================
// 概览：两请求同 range
// ===========================================================================

describe('fetchUsageOverview 的请求边界', () => {
  it('并行请求 stats 与 snapshot-v2 两个固定路径，不请求别的', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
    });

    await fetchUsageOverview(request, RANGE, 'day');

    expect(calls).toHaveLength(2);
    expect(calls.map((c) => splitPath(c.path).base).sort()).toEqual([
      '/usage/dashboard/snapshot-v2',
      '/usage/stats',
    ]);
    for (const call of calls) {
      expect(call.options?.method).toBe('GET');
    }
  });

  it('两个请求携带完全相同的 start_date / end_date / timezone / granularity', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
    });

    await fetchUsageOverview(request, RANGE, 'day');

    const stats = findCall(calls, '/usage/stats').params;
    const snapshot = findCall(calls, '/usage/dashboard/snapshot-v2').params;
    for (const params of [stats, snapshot]) {
      expect(params.get('start_date')).toBe('2026-09-21');
      expect(params.get('end_date')).toBe('2026-09-27');
      expect(params.get('timezone')).toBe(SH);
      expect(params.get('granularity')).toBe('day');
    }
  });

  it('granularity 为 hour 时原样传递', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
    });

    await fetchUsageOverview(request, RANGE, 'hour');

    expect(findCall(calls, '/usage/stats').params.get('granularity')).toBe('hour');
    expect(findCall(calls, '/usage/dashboard/snapshot-v2').params.get('granularity')).toBe('hour');
  });

  it('snapshot-v2 显式要求 trend / model / group 三类统计', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
    });

    await fetchUsageOverview(request, RANGE, 'day');

    const params = findCall(calls, '/usage/dashboard/snapshot-v2').params;
    expect(params.get('include_trend')).toBe('true');
    expect(params.get('include_model_stats')).toBe('true');
    expect(params.get('include_group_stats')).toBe('true');
  });

  it('不请求 /usage/dashboard/stats 或 /user/profile（累计统计不混进区间概览）', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
    });

    await fetchUsageOverview(request, RANGE, 'day');

    for (const call of calls) {
      expect(call.path.startsWith('/usage/dashboard/stats')).toBe(false);
      expect(call.path.startsWith('/user/profile')).toBe(false);
    }
  });

  it('任一请求失败时整体失败', async () => {
    const { request } = spyRequest({
      '/usage/stats': new Error('boom'),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
    });

    await expect(fetchUsageOverview(request, RANGE, 'day')).rejects.toThrow('boom');
  });
});

describe('parseUsageOverview 的合并与字段映射', () => {
  it('汇总、接口分布取 stats，模型/分组/趋势取 snapshot', () => {
    const overview = parseUsageOverview(statsPayload(), snapshotPayload());

    expect(overview.summary.requests).toBe(42);
    expect(overview.summary.averageDurationMs).toBe(640.5);
    expect(overview.endpoints).toEqual([
      {
        id: '/v1/chat/completions',
        label: '/v1/chat/completions',
        requests: 30,
        tokens: 2000,
        cost: 1,
      },
      { id: '/v1/messages', label: '/v1/messages', requests: 12, tokens: 800, cost: 0.25 },
    ]);
    expect(overview.models).toEqual([
      {
        id: 'claude-sonnet-4',
        label: 'claude-sonnet-4',
        requests: 30,
        tokens: 2000,
        cost: 1,
      },
    ]);
    expect(overview.groups).toEqual([
      { id: '7', label: '团队A', requests: 42, tokens: 2800, cost: 1.25 },
    ]);
    expect(overview.trend).toHaveLength(2);
    expect(overview.trend[1]).toEqual({
      date: '2026-09-27',
      requests: 22,
      tokens: { input: 600, output: 400, cacheWrite: 200, cacheRead: 300, total: 1500 },
      actualCost: 0.65,
    });
  });

  it('四类 Token 与 total 各自独立，实际消费与标准消费分开', () => {
    const overview = parseUsageOverview(statsPayload(), snapshotPayload());

    expect(overview.summary.tokens).toEqual({
      input: 1200,
      output: 800,
      cacheWrite: 300,
      cacheRead: 500,
      total: 2800,
    });
    expect(overview.summary.actualCost).toBe(1.25);
    expect(overview.summary.standardCost).toBe(2.5);
    // 实际消费不等于标准消费，不能被折叠成一个数。
    expect(overview.summary.actualCost).not.toBe(overview.summary.standardCost);
  });

  it('stats 的 account_cost / upstream_endpoints 不进入返回', () => {
    const overview = parseUsageOverview(statsPayload(), snapshotPayload());

    const serialized = JSON.stringify(overview);
    expect(serialized).not.toContain('9.99');
    expect(serialized).not.toContain('upstream-only');
    expect(serialized).not.toContain('999999');
    expect(overview.endpoints).toHaveLength(2);
    for (const row of overview.endpoints) {
      expect(Object.keys(row).sort()).toEqual(['cost', 'id', 'label', 'requests', 'tokens']);
    }
  });

  it('Go nil 数组（null）按空数组处理', () => {
    const overview = parseUsageOverview(
      statsPayload({ endpoints: null }),
      snapshotPayload({ trend: null, models: null, groups: null }),
    );

    expect(overview.endpoints).toEqual([]);
    expect(overview.trend).toEqual([]);
    expect(overview.models).toEqual([]);
    expect(overview.groups).toEqual([]);
  });

  it('合法空数组合法', () => {
    const overview = parseUsageOverview(
      statsPayload({ endpoints: [] }),
      snapshotPayload({ trend: [], models: [], groups: [] }),
    );

    expect(overview.endpoints).toEqual([]);
    expect(overview.trend).toEqual([]);
  });

  it('stats 缺失或非对象时抛异常', () => {
    expect(() => parseUsageOverview(undefined, snapshotPayload())).toThrow();
    expect(() => parseUsageOverview(null, snapshotPayload())).toThrow();
    expect(() => parseUsageOverview([], snapshotPayload())).toThrow();
    expect(() => parseUsageOverview(statsPayload(), undefined)).toThrow();
    expect(() => parseUsageOverview(statsPayload(), null)).toThrow();
  });
});

describe('parseUsageOverview 对缺失/NaN/负数的拒绝', () => {
  const summaryFields = [
    'total_requests',
    'total_input_tokens',
    'total_output_tokens',
    'total_cache_creation_tokens',
    'total_cache_read_tokens',
    'total_tokens',
    'total_actual_cost',
    'total_cost',
    'average_duration_ms',
  ];

  it.each(summaryFields)('stats 缺失 %s 抛异常而不是补零', (field) => {
    const stats = statsPayload();
    delete stats[field];
    expect(() => parseUsageOverview(stats, snapshotPayload())).toThrow();
  });

  it.each(summaryFields)('stats 的 %s 为 NaN 抛异常', (field) => {
    expect(() =>
      parseUsageOverview(statsPayload({ [field]: Number.NaN }), snapshotPayload()),
    ).toThrow();
  });

  it.each([
    'total_requests',
    'total_input_tokens',
    'total_output_tokens',
    'total_cache_creation_tokens',
    'total_cache_read_tokens',
    'total_tokens',
    'total_actual_cost',
    'total_cost',
  ])('stats 的 %s 为负数抛异常', (field) => {
    expect(() => parseUsageOverview(statsPayload({ [field]: -1 }), snapshotPayload())).toThrow();
  });

  it('token 字段是字符串时抛异常', () => {
    expect(() =>
      parseUsageOverview(statsPayload({ total_input_tokens: '1200' }), snapshotPayload()),
    ).toThrow();
  });

  it('endpoints 项缺失 requests 或 total_tokens 抛异常', () => {
    const bad = { endpoint: '/v1/chat/completions', actual_cost: 1 };
    expect(() =>
      parseUsageOverview(statsPayload({ endpoints: [bad] }), snapshotPayload()),
    ).toThrow();
  });

  it('endpoints 项为负数抛异常', () => {
    const bad = { endpoint: '/x', requests: -1, total_tokens: 10, actual_cost: 0.1 };
    expect(() =>
      parseUsageOverview(statsPayload({ endpoints: [bad] }), snapshotPayload()),
    ).toThrow();
  });

  it('trend 项缺失 total_tokens 抛异常', () => {
    const bad = {
      date: '2026-09-27',
      requests: 1,
      input_tokens: 1,
      output_tokens: 1,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
      actual_cost: 0.1,
    };
    expect(() => parseUsageOverview(statsPayload(), snapshotPayload({ trend: [bad] }))).toThrow();
  });

  it('models 项缺失 total_tokens 抛异常', () => {
    const bad = { model: 'm', requests: 1, actual_cost: 0.1 };
    expect(() => parseUsageOverview(statsPayload(), snapshotPayload({ models: [bad] }))).toThrow();
  });

  it('groups 项 group_id 为负数抛异常', () => {
    const bad = { group_id: -3, group_name: 'g', requests: 1, total_tokens: 1, actual_cost: 0.1 };
    expect(() => parseUsageOverview(statsPayload(), snapshotPayload({ groups: [bad] }))).toThrow();
  });

  it('endpoints 非数组且非 null 抛异常', () => {
    expect(() =>
      parseUsageOverview(statsPayload({ endpoints: 'nope' }), snapshotPayload()),
    ).toThrow();
  });
});

// ===========================================================================
// 明细：请求参数与适配
// ===========================================================================

describe('fetchUsageRecords 的请求参数', () => {
  const filters: UsageFilters = {
    range: RANGE,
    page: 2,
    pageSize: 20,
    model: 'claude-sonnet-4',
    keyId: 5,
  };

  it('GET /usage 且带 page / page_size / 日期范围 / 时区 / model / api_key_id', async () => {
    const { request, calls } = spyRequest({ '/usage': pagePayload([recordPayload()]) });

    await fetchUsageRecords(request, filters);

    expect(calls).toHaveLength(1);
    const { base, params } = splitPath(calls[0]?.path ?? '');
    expect(base).toBe('/usage');
    expect(params.get('page')).toBe('2');
    expect(params.get('page_size')).toBe('20');
    expect(params.get('start_date')).toBe('2026-09-21');
    expect(params.get('end_date')).toBe('2026-09-27');
    expect(params.get('timezone')).toBe(SH);
    expect(params.get('model')).toBe('claude-sonnet-4');
    expect(params.get('api_key_id')).toBe('5');
    expect(calls[0]?.options?.method).toBe('GET');
  });

  it('model 为空或未提供时不带 model 参数', async () => {
    const { request, calls } = spyRequest({ '/usage': pagePayload([]) });

    await fetchUsageRecords(request, { range: RANGE, page: 1, pageSize: 20 });
    expect(findCall(calls, '/usage').params.has('model')).toBe(false);

    const second = spyRequest({ '/usage': pagePayload([]) });
    await fetchUsageRecords(second.request, { range: RANGE, page: 1, pageSize: 20, model: '' });
    expect(findCall(second.calls, '/usage').params.has('model')).toBe(false);
  });

  it('keyId 未提供时不带 api_key_id 参数', async () => {
    const { request, calls } = spyRequest({ '/usage': pagePayload([]) });

    await fetchUsageRecords(request, { range: RANGE, page: 1, pageSize: 20 });

    expect(findCall(calls, '/usage').params.has('api_key_id')).toBe(false);
  });
});

describe('parseUsageRecords 明细字段', () => {
  it('映射白名单字段并透传分页', () => {
    const result = parseUsageRecords(pagePayload([recordPayload()]));

    expect(result.total).toBe(43);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(20);
    expect(result.pages).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: 101,
      createdAt: '2026-09-27T02:15:30Z',
      model: 'claude-sonnet-4',
      keyName: 'prod-key',
      keyId: 5,
      tokens: { input: 100, output: 50, cacheWrite: 30, cacheRead: 20, total: 200 },
      actualCost: 0.12,
      standardCost: 0.24,
      durationMs: 812,
      stream: true,
    });
  });

  it('绝不泄露 api_key.key，只读 api_key.name', () => {
    const result = parseUsageRecords(
      pagePayload([
        recordPayload({
          api_key: { id: 5, name: 'prod-key', key: 'sk-live-SECRET', secret: 'also-secret' },
        }),
      ]),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('sk-live-SECRET');
    expect(serialized).not.toContain('also-secret');
    expect(result.items[0]?.keyName).toBe('prod-key');
    expect(Object.keys(result.items[0] ?? {}).sort()).toEqual([
      'actualCost',
      'createdAt',
      'durationMs',
      'id',
      'keyId',
      'keyName',
      'model',
      'standardCost',
      'stream',
      'tokens',
    ]);
  });

  it('api_key 缺失或 name 缺失时 keyName 为空串', () => {
    const missing = parseUsageRecords(pagePayload([recordPayload({ api_key: null })]));
    expect(missing.items[0]?.keyName).toBe('');

    const noName = parseUsageRecords(
      pagePayload([recordPayload({ api_key: { id: 5, key: 'sk-x' } })]),
    );
    expect(noName.items[0]?.keyName).toBe('');
    expect(JSON.stringify(noName)).not.toContain('sk-x');
  });

  it('total_tokens 缺失或为 null 时按四类之和，缓存写入与读取保持区分', () => {
    const missing = recordPayload();
    delete missing.total_tokens;
    const result = parseUsageRecords(pagePayload([missing]));

    expect(result.items[0]?.tokens).toEqual({
      input: 100,
      output: 50,
      cacheWrite: 30,
      cacheRead: 20,
      total: 200,
    });
    expect(result.items[0]?.tokens.cacheWrite).not.toBe(result.items[0]?.tokens.cacheRead);
    expect(result.items[0]?.tokens.total).toBe(200);

    const nulled = parseUsageRecords(pagePayload([recordPayload({ total_tokens: null })]));
    expect(nulled.items[0]?.tokens.total).toBe(200);
  });

  it('total_tokens 存在时使用原字段值', () => {
    const result = parseUsageRecords(pagePayload([recordPayload({ total_tokens: 999 })]));
    expect(result.items[0]?.tokens.total).toBe(999);
  });

  it('duration_ms 为 null 或缺失时保留 null', () => {
    const nulled = parseUsageRecords(pagePayload([recordPayload({ duration_ms: null })]));
    expect(nulled.items[0]?.durationMs).toBeNull();

    const missing = recordPayload();
    delete missing.duration_ms;
    const result = parseUsageRecords(pagePayload([missing]));
    expect(result.items[0]?.durationMs).toBeNull();
  });

  it('Go nil items 按空数组合法处理', () => {
    const result = parseUsageRecords(pagePayload([], { items: null, total: 0, pages: 0 }));
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe('parseUsageRecords 对缺失/NaN/负数的拒绝', () => {
  const requiredFields = [
    'id',
    'api_key_id',
    'input_tokens',
    'output_tokens',
    'cache_creation_tokens',
    'cache_read_tokens',
    'actual_cost',
    'total_cost',
  ];

  it.each(requiredFields)('明细缺失 %s 抛异常而不是补零', (field) => {
    const record = recordPayload();
    delete record[field];
    expect(() => parseUsageRecords(pagePayload([record]))).toThrow();
  });

  it.each(requiredFields)('明细的 %s 为 NaN 抛异常', (field) => {
    expect(() =>
      parseUsageRecords(pagePayload([recordPayload({ [field]: Number.NaN })])),
    ).toThrow();
  });

  it.each(requiredFields)('明细的 %s 为负数抛异常', (field) => {
    expect(() => parseUsageRecords(pagePayload([recordPayload({ [field]: -1 })]))).toThrow();
  });

  it('total_tokens 为 NaN 或负数抛异常', () => {
    expect(() =>
      parseUsageRecords(pagePayload([recordPayload({ total_tokens: Number.NaN })])),
    ).toThrow();
    expect(() => parseUsageRecords(pagePayload([recordPayload({ total_tokens: -5 })]))).toThrow();
  });

  it('stream 非布尔抛异常', () => {
    expect(() => parseUsageRecords(pagePayload([recordPayload({ stream: 'true' })]))).toThrow();
  });

  it('created_at / model 非字符串抛异常', () => {
    expect(() => parseUsageRecords(pagePayload([recordPayload({ created_at: 123 })]))).toThrow();
    expect(() => parseUsageRecords(pagePayload([recordPayload({ model: null })]))).toThrow();
  });

  it('分页字段缺失或非法抛异常', () => {
    const missing = pagePayload([recordPayload()]);
    delete missing.pages;
    expect(() => parseUsageRecords(missing)).toThrow();
    expect(() => parseUsageRecords(pagePayload([recordPayload()], { page: -1 }))).toThrow();
    expect(() => parseUsageRecords(undefined)).toThrow();
  });
});

// ===========================================================================
// 当前资金
// ===========================================================================

describe('fetchCurrentFunds 的角色分支', () => {
  it('非组织成员只请求 /user/profile', async () => {
    const { request, calls } = spyRequest({
      '/user/profile': { balance: 12.5, frozen_balance: 3 },
    });

    const funds = await fetchCurrentFunds(request, memberUser({ organization: null }));

    expect(funds).toEqual({ kind: 'balance', amount: 12.5, frozen: 3 });
    expect(calls).toHaveLength(1);
    expect(splitPath(calls[0]?.path ?? '').base).toBe('/user/profile');
  });

  it('组织创建者只请求 /user/profile', async () => {
    const { request, calls } = spyRequest({
      '/user/profile': { balance: 4, frozen_balance: 0 },
    });

    await fetchCurrentFunds(
      request,
      memberUser({ organization: { id: 3, name: 'Acme', isOwner: true, status: 'active' } }),
    );

    expect(calls).toHaveLength(1);
    expect(splitPath(calls[0]?.path ?? '').base).toBe('/user/profile');
  });

  it('普通组织成员只请求 /usage/dashboard/stats，不请求 /user/profile', async () => {
    const { request, calls } = spyRequest({
      '/usage/dashboard/stats': {
        total_requests: 999,
        organization_quota: { remaining: 250, window_end: '2026-10-01T00:00:00Z' },
      },
    });

    const funds = await fetchCurrentFunds(request, memberUser({ balance: 77 }));

    expect(funds).toEqual({ kind: 'quota', amount: 250, windowEnd: '2026-10-01T00:00:00Z' });
    expect(calls).toHaveLength(1);
    expect(splitPath(calls[0]?.path ?? '').base).toBe('/usage/dashboard/stats');
    for (const call of calls) {
      expect(call.path.startsWith('/user/profile')).toBe(false);
      expect(call.path.startsWith('/usage/stats')).toBe(false);
      expect(call.path.startsWith('/usage/dashboard/snapshot-v2')).toBe(false);
    }
  });

  it('普通成员的累计 stats 不进入区间概览请求', async () => {
    const { request, calls } = spyRequest({
      '/usage/dashboard/stats': { organization_quota: { remaining: 1, window_end: null } },
    });

    await fetchCurrentFunds(request, memberUser());

    expect(calls.map((c) => splitPath(c.path).base)).toEqual(['/usage/dashboard/stats']);
  });
});

describe('parseQuotaFunds / parseBalanceFunds 的边界', () => {
  it('quota.remaining 为 null 是明示的不限额', () => {
    expect(parseQuotaFunds({ organization_quota: { remaining: null, window_end: null } })).toEqual({
      kind: 'quota',
      amount: null,
      windowEnd: null,
    });
  });

  it('quota.remaining 缺失时必须抛安全错误，不能猜成不限', () => {
    expect(() => parseQuotaFunds({ organization_quota: { window_end: null } })).toThrow();
    expect(() => parseQuotaFunds({ organization_quota: {} })).toThrow();
  });

  it('organization_quota 缺失或为 null 抛安全错误', () => {
    expect(() => parseQuotaFunds({})).toThrow();
    expect(() => parseQuotaFunds({ organization_quota: null })).toThrow();
    expect(() => parseQuotaFunds(undefined)).toThrow();
  });

  it('quota.remaining 为 NaN / 负数 / 字符串时抛异常', () => {
    expect(() =>
      parseQuotaFunds({ organization_quota: { remaining: Number.NaN, window_end: null } }),
    ).toThrow();
    expect(() =>
      parseQuotaFunds({ organization_quota: { remaining: -5, window_end: null } }),
    ).toThrow();
    expect(() =>
      parseQuotaFunds({ organization_quota: { remaining: '250', window_end: null } }),
    ).toThrow();
  });

  it('window_end 非法字符串抛异常，合法 ISO 保留原值', () => {
    expect(() =>
      parseQuotaFunds({ organization_quota: { remaining: 1, window_end: 'not-a-date' } }),
    ).toThrow();
    expect(
      parseQuotaFunds({ organization_quota: { remaining: 1, window_end: '2026-10-01T00:00:00Z' } }),
    ).toEqual({ kind: 'quota', amount: 1, windowEnd: '2026-10-01T00:00:00Z' });
  });

  it('余额可以为负（后端允许欠费透支）', () => {
    expect(parseBalanceFunds({ balance: -12.5, frozen_balance: 3 })).toEqual({
      kind: 'balance',
      amount: -12.5,
      frozen: 3,
    });
  });

  it('余额字段缺失 / NaN / 字符串抛异常', () => {
    expect(() => parseBalanceFunds({ frozen_balance: 0 })).toThrow();
    expect(() => parseBalanceFunds({ balance: Number.NaN, frozen_balance: 0 })).toThrow();
    expect(() => parseBalanceFunds({ balance: '12.5', frozen_balance: 0 })).toThrow();
    expect(() => parseBalanceFunds(undefined)).toThrow();
  });
});
