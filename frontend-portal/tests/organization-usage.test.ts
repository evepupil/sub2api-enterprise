/**
 * M4 独立组织统计测试（Vitest，Node 环境）。
 *
 * 契约来源：.fleet/briefs/m45-organization-usage-api.md、
 * src/features/organization-usage/types.ts。
 *
 * 只断言任务书要求的行为，不迁就实现：
 * - 所有组织查询必须显式带 scope=organization。
 * - 筛选成员只用 member_user_id，绝不用个人接口的 user_id。
 * - stats / snapshot-v2 共用同一日期、时区、粒度与成员；成员分布固定全组织
 *   （不带 member_user_id）。
 * - 明细走 /usage?scope=organization，不能被 /usage/stats 或
 *   /usage/dashboard/stats 代替。
 * - 四类 Token、标准价与实际价彼此独立；owner 与停用成员不被丢弃；
 *   没有日志的成员不伪造行数；昵称缺失回落到 email / 成员#id；
 *   绝不泄露 api_key.key 或用户余额。
 */
import { describe, expect, it } from 'vitest';

import {
  parseMemberUsage,
  parseOrganizationRecords,
} from '../src/features/organization-usage/adapter';
import {
  fetchOrganizationOverview,
  fetchOrganizationRecords,
} from '../src/features/organization-usage/api';
import type {
  OrganizationUsageFilters,
  OrganizationUsageRecordFilters,
} from '../src/features/organization-usage/types';
import type { ApiRequestOptions, ApiRequester } from '../src/features/auth/types';
import type { DateRange } from '../src/features/usage/types';

type Json = Record<string, unknown>;

const SH = 'Asia/Shanghai';
const RANGE: DateRange = { start: '2026-09-21', end: '2026-09-27', timeZone: SH };

interface Call {
  path: string;
  options: ApiRequestOptions | undefined;
}

/** 注入式 request spy：记录 path / options，未登记路径直接抛错。 */
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
// 夹具：/usage/stats、/usage/dashboard/snapshot-v2、/usage/organization/members
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
    ],
    // 组织区间统计绝不能读累计统计接口的字段。
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
      { model: 'claude-sonnet-4', requests: 30, total_tokens: 2000, actual_cost: 1, cost: 2 },
    ],
    groups: [
      { group_id: 7, group_name: '团队A', requests: 42, total_tokens: 2800, actual_cost: 1.25 },
    ],
    ...overrides,
  };
}

function membersPayload(members: unknown[], overrides: Json = {}): Json {
  return {
    start_date: '2026-09-21',
    end_date: '2026-09-27',
    members,
    ...overrides,
  };
}

function memberRow(overrides: Json = {}): Json {
  return {
    user_id: 9,
    email: 'member@example.com',
    username: 'member',
    display_name: '成员九',
    requests: 12,
    total_tokens: 3400,
    cost: 2.5,
    actual_cost: 1.25,
    ...overrides,
  };
}

function recordPayload(overrides: Json = {}): Json {
  return {
    id: 101,
    created_at: '2026-09-27T02:15:30Z',
    model: 'claude-sonnet-4',
    api_key_id: 5,
    api_key: { id: 5, name: 'prod-key', key: 'sk-live-SECRET', user_id: 9 },
    input_tokens: 100,
    output_tokens: 50,
    cache_creation_tokens: 30,
    cache_read_tokens: 20,
    total_tokens: 200,
    actual_cost: 0.12,
    total_cost: 0.24,
    duration_ms: 812,
    stream: true,
    user_id: 9,
    user: {
      id: 9,
      email: 'member@example.com',
      username: 'member',
      display_name: '成员九',
      balance: 999.5,
      api_key: { key: 'sk-live-SECRET' },
    },
    ...overrides,
  };
}

function pagePayload(items: unknown[], overrides: Json = {}): Json {
  return { items, total: 43, page: 2, page_size: 20, pages: 3, ...overrides };
}

const OVERVIEW_FILTERS: OrganizationUsageFilters = { range: RANGE, granularity: 'day' };

// ===========================================================================
// 概览：三个请求的 scope / 日期 / 粒度 / 成员筛选
// ===========================================================================

describe('fetchOrganizationOverview 的请求边界', () => {
  it('并行请求 stats、snapshot-v2 与组织成员分布三个路径，不请求别的', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
      '/usage/organization/members': membersPayload([memberRow()]),
    });

    await fetchOrganizationOverview(request, OVERVIEW_FILTERS);

    expect(calls).toHaveLength(3);
    expect(calls.map((c) => splitPath(c.path).base).sort()).toEqual([
      '/usage/dashboard/snapshot-v2',
      '/usage/organization/members',
      '/usage/stats',
    ]);
    for (const call of calls) {
      expect(call.options?.method).toBe('GET');
    }
  });

  it('每个组织请求都显式带 scope=organization', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
      '/usage/organization/members': membersPayload([memberRow()]),
    });

    await fetchOrganizationOverview(request, OVERVIEW_FILTERS);

    for (const call of calls) {
      expect(splitPath(call.path).params.get('scope')).toBe('organization');
    }
  });

  it('stats 与 snapshot 共用同一日期、时区、粒度与成员筛选', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
      '/usage/organization/members': membersPayload([memberRow()]),
    });

    await fetchOrganizationOverview(request, {
      range: RANGE,
      granularity: 'hour',
      memberId: 9,
    });

    const stats = findCall(calls, '/usage/stats').params;
    const snapshot = findCall(calls, '/usage/dashboard/snapshot-v2').params;
    for (const params of [stats, snapshot]) {
      expect(params.get('start_date')).toBe('2026-09-21');
      expect(params.get('end_date')).toBe('2026-09-27');
      expect(params.get('timezone')).toBe(SH);
      expect(params.get('granularity')).toBe('hour');
      expect(params.get('member_user_id')).toBe('9');
      // 组织筛选绝不复用个人接口的 user_id 语义。
      expect(params.get('user_id')).toBeNull();
    }
  });

  it('成员分布固定全组织：带日期与 scope，但不带 member_user_id', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
      '/usage/organization/members': membersPayload([memberRow()]),
    });

    await fetchOrganizationOverview(request, {
      range: RANGE,
      granularity: 'day',
      memberId: 9,
    });

    const params = findCall(calls, '/usage/organization/members').params;
    expect(params.get('scope')).toBe('organization');
    expect(params.get('start_date')).toBe('2026-09-21');
    expect(params.get('end_date')).toBe('2026-09-27');
    expect(params.get('timezone')).toBe(SH);
    expect(params.has('member_user_id')).toBe(false);
    expect(params.get('member_user_id')).toBeNull();
  });

  it('snapshot-v2 显式要求 trend / model / group 三类统计', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
      '/usage/organization/members': membersPayload([memberRow()]),
    });

    await fetchOrganizationOverview(request, OVERVIEW_FILTERS);

    const params = findCall(calls, '/usage/dashboard/snapshot-v2').params;
    expect(params.get('include_trend')).toBe('true');
    expect(params.get('include_model_stats')).toBe('true');
    expect(params.get('include_group_stats')).toBe('true');
  });

  it('累计统计接口 /usage/dashboard/stats 不作为组织区间统计来源', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
      '/usage/organization/members': membersPayload([memberRow()]),
    });

    await fetchOrganizationOverview(request, OVERVIEW_FILTERS);

    for (const call of calls) {
      expect(call.path.startsWith('/usage/dashboard/stats')).toBe(false);
    }
  });

  it('未传成员时不带 member_user_id', async () => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
      '/usage/organization/members': membersPayload([memberRow()]),
    });

    await fetchOrganizationOverview(request, OVERVIEW_FILTERS);

    for (const call of calls) {
      expect(splitPath(call.path).params.has('member_user_id')).toBe(false);
    }
  });

  it('概览合并结果：四类 Token 与 total、标准价与实际价彼此独立', async () => {
    const { request } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
      '/usage/organization/members': membersPayload([memberRow()]),
    });

    const overview = await fetchOrganizationOverview(request, OVERVIEW_FILTERS);

    expect(overview.overview.summary.tokens).toEqual({
      input: 1200,
      output: 800,
      cacheWrite: 300,
      cacheRead: 500,
      total: 2800,
    });
    expect(overview.overview.summary.actualCost).toBe(1.25);
    expect(overview.overview.summary.standardCost).toBe(2.5);
    expect(overview.overview.summary.actualCost).not.toBe(overview.overview.summary.standardCost);
    expect(overview.members).toHaveLength(1);
    expect(overview.members[0]).toEqual({
      userId: 9,
      email: 'member@example.com',
      username: 'member',
      displayName: '成员九',
      requests: 12,
      tokens: 3400,
      standardCost: 2.5,
      actualCost: 1.25,
    });
  });

  it('任一请求失败时整体失败', async () => {
    const { request } = spyRequest({
      '/usage/stats': new Error('boom'),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
      '/usage/organization/members': membersPayload([memberRow()]),
    });

    await expect(fetchOrganizationOverview(request, OVERVIEW_FILTERS)).rejects.toThrow('boom');
  });
});

describe('fetchOrganizationOverview 的参数拒绝', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    '成员标识 %s 不合法时拒绝，且不发任何请求',
    async (memberId) => {
      const { request, calls } = spyRequest({
        '/usage/stats': statsPayload(),
        '/usage/dashboard/snapshot-v2': snapshotPayload(),
        '/usage/organization/members': membersPayload([memberRow()]),
      });

      await expect(
        fetchOrganizationOverview(request, { range: RANGE, granularity: 'day', memberId }),
      ).rejects.toThrow();
      expect(calls).toHaveLength(0);
    },
  );

  it.each(['week', 'month', 'all'])('粒度 %s 不合法时拒绝，且不发任何请求', async (granularity) => {
    const { request, calls } = spyRequest({
      '/usage/stats': statsPayload(),
      '/usage/dashboard/snapshot-v2': snapshotPayload(),
      '/usage/organization/members': membersPayload([memberRow()]),
    });

    await expect(
      fetchOrganizationOverview(request, {
        range: RANGE,
        granularity: granularity as never,
      }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

// ===========================================================================
// 成员分布适配
// ===========================================================================

describe('parseMemberUsage', () => {
  it('owner 本人与停用成员的历史一并保留', () => {
    const rows = parseMemberUsage(
      membersPayload([
        memberRow({ user_id: 1, display_name: 'Owner', email: 'owner@example.com' }),
        memberRow({
          user_id: 2,
          display_name: null,
          username: 'disabled',
          email: 'disabled@example.com',
          status: 'disabled',
        }),
      ]),
    );

    expect(rows.map((row) => row.userId)).toEqual([1, 2]);
    expect(rows[1]?.username).toBe('disabled');
  });

  it('昵称/邮箱缺失时按空串返回，不伪造身份', () => {
    const rows = parseMemberUsage(
      membersPayload([memberRow({ user_id: 3, display_name: null, username: null, email: null })]),
    );

    expect(rows[0]).toEqual({
      userId: 3,
      email: '',
      username: '',
      displayName: '',
      requests: 12,
      tokens: 3400,
      standardCost: 2.5,
      actualCost: 1.25,
    });
  });

  it('Go nil 数组（null）与合法空数组合法，且不伪造成员行', () => {
    expect(parseMemberUsage(membersPayload([], { members: null }))).toEqual([]);
    expect(parseMemberUsage(membersPayload([]))).toEqual([]);
  });

  it('只返回 members 数组里的成员，不按组织成员数补行', () => {
    const rows = parseMemberUsage(membersPayload([memberRow({ user_id: 9 })]));
    expect(rows).toHaveLength(1);
  });

  it.each(['requests', 'total_tokens', 'cost', 'actual_cost'])(
    '%s 缺失时抛异常，不猜 0',
    (field) => {
      const row = memberRow();
      delete row[field];
      expect(() => parseMemberUsage(membersPayload([row]))).toThrow();
    },
  );

  it('非正 / 非整数 user_id 抛异常', () => {
    expect(() => parseMemberUsage(membersPayload([memberRow({ user_id: 0 })]))).toThrow();
    expect(() => parseMemberUsage(membersPayload([memberRow({ user_id: '9' })]))).toThrow();
  });

  it('成员行不透传额外字段（不含密钥或余额）', () => {
    const rows = parseMemberUsage(
      membersPayload([
        memberRow({ api_key: { key: 'sk-live-SECRET' }, balance: 999.5, organization: { id: 3 } }),
      ]),
    );

    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('999.5');
    expect(serialized).not.toContain('organization');
    expect(Object.keys(rows[0]!).sort()).toEqual([
      'actualCost',
      'displayName',
      'email',
      'requests',
      'standardCost',
      'tokens',
      'userId',
      'username',
    ]);
  });
});

// ===========================================================================
// 明细：/usage?scope=organization
// ===========================================================================

describe('fetchOrganizationRecords 的请求边界', () => {
  const RECORD_FILTERS: OrganizationUsageRecordFilters = {
    range: RANGE,
    page: 2,
    pageSize: 20,
  };

  it('走 /usage 分页明细，显式带 scope=organization 与分页/日期参数', async () => {
    const { request, calls } = spyRequest({ '/usage': pagePayload([recordPayload()]) });

    await fetchOrganizationRecords(request, RECORD_FILTERS);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.options?.method).toBe('GET');
    const { base, params } = splitPath(calls[0]!.path);
    expect(base).toBe('/usage');
    expect(params.get('scope')).toBe('organization');
    expect(params.get('start_date')).toBe('2026-09-21');
    expect(params.get('end_date')).toBe('2026-09-27');
    expect(params.get('timezone')).toBe(SH);
    expect(params.get('page')).toBe('2');
    expect(params.get('page_size')).toBe('20');
    expect(params.get('model')).toBeNull();
    expect(params.get('member_user_id')).toBeNull();
    expect(params.get('user_id')).toBeNull();
  });

  it('不能被 /usage/stats 或 /usage/dashboard/stats 代替', async () => {
    const { request, calls } = spyRequest({ '/usage': pagePayload([recordPayload()]) });

    await fetchOrganizationRecords(request, RECORD_FILTERS);

    for (const call of calls) {
      expect(call.path.startsWith('/usage/stats')).toBe(false);
      expect(call.path.startsWith('/usage/dashboard/stats')).toBe(false);
    }
  });

  it('筛选具体成员只用 member_user_id', async () => {
    const { request, calls } = spyRequest({ '/usage': pagePayload([recordPayload()]) });

    await fetchOrganizationRecords(request, { ...RECORD_FILTERS, memberId: 9 });

    const { params } = splitPath(calls[0]!.path);
    expect(params.get('member_user_id')).toBe('9');
    expect(params.get('user_id')).toBeNull();
  });

  it('model 筛选存在时原样传递，空串则不带', async () => {
    const { request, calls } = spyRequest({ '/usage': pagePayload([recordPayload()]) });

    await fetchOrganizationRecords(request, { ...RECORD_FILTERS, model: 'claude-sonnet-4' });
    expect(splitPath(calls[0]!.path).params.get('model')).toBe('claude-sonnet-4');

    const second = spyRequest({ '/usage': pagePayload([recordPayload()]) });
    await fetchOrganizationRecords(second.request, { ...RECORD_FILTERS, model: '' });
    expect(splitPath(second.calls[0]!.path).params.get('model')).toBeNull();
  });

  it('成员标识不合法时拒绝，且不发请求', async () => {
    const { request, calls } = spyRequest({ '/usage': pagePayload([recordPayload()]) });

    await expect(
      fetchOrganizationRecords(request, { ...RECORD_FILTERS, memberId: 0 }),
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('分页字段透传', async () => {
    const { request } = spyRequest({
      '/usage': pagePayload([recordPayload()], { total: 43, page: 2, page_size: 20, pages: 3 }),
    });

    const result = await fetchOrganizationRecords(request, RECORD_FILTERS);
    expect(result.total).toBe(43);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(20);
    expect(result.pages).toBe(3);
  });
});

describe('parseOrganizationRecords', () => {
  it('逐条补 userId 与 userLabel，且保留安全明细', () => {
    const result = parseOrganizationRecords(pagePayload([recordPayload()]));

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 101,
      model: 'claude-sonnet-4',
      keyName: 'prod-key',
      userId: 9,
      userLabel: '成员九',
      actualCost: 0.12,
      standardCost: 0.24,
    });
  });

  it('绝不携带 api_key.key 或用户余额', () => {
    const result = parseOrganizationRecords(pagePayload([recordPayload()]));
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('999.5');
    expect(serialized).not.toContain('balance');
  });

  it('昵称缺失时按 username → email → 成员#id 回落', () => {
    const byUsername = parseOrganizationRecords(
      pagePayload([
        recordPayload({
          user: { id: 9, email: 'member@example.com', username: 'member', display_name: null },
        }),
      ]),
    );
    expect(byUsername.items[0]?.userLabel).toBe('member');

    const byEmail = parseOrganizationRecords(
      pagePayload([
        recordPayload({
          user: { id: 9, email: 'member@example.com', username: '', display_name: '' },
        }),
      ]),
    );
    expect(byEmail.items[0]?.userLabel).toBe('member@example.com');

    const byId = parseOrganizationRecords(
      pagePayload([recordPayload({ user_id: 42, user: null })]),
    );
    expect(byId.items[0]?.userLabel).toBe('成员#42');
  });

  it('组织成员没有日志时不伪造行数', () => {
    const result = parseOrganizationRecords(pagePayload([], { total: 0, pages: 0 }));
    expect(result.items).toEqual([]);
  });

  it('Go nil 明细数组（null）按空数组处理', () => {
    const result = parseOrganizationRecords(pagePayload([], { items: null, total: 0, pages: 0 }));
    expect(result.items).toEqual([]);
  });

  it('缺少 user_id 时抛异常，不用其它字段凑合', () => {
    const row = recordPayload();
    delete row.user_id;
    expect(() => parseOrganizationRecords(pagePayload([row]))).toThrow();
  });

  it('四类 Token 与 total 各自独立，实际价与标准价分开', () => {
    const result = parseOrganizationRecords(pagePayload([recordPayload()]));
    expect(result.items[0]?.tokens).toEqual({
      input: 100,
      output: 50,
      cacheWrite: 30,
      cacheRead: 20,
      total: 200,
    });
    expect(result.items[0]?.actualCost).not.toBe(result.items[0]?.standardCost);
  });
});
