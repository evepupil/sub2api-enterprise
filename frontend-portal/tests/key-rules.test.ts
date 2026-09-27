/**
 * M2 独立密钥业务规则测试。
 *
 * 契约来源：.fleet/briefs/m23-keys-api.md、src/features/keys/types.ts、design/customer-console.md 第 3 节。
 * 只覆盖纯校验/适配/请求边界，请求全部用 mock，不发真实网络请求。
 *
 * 业务事实（任务书）：
 * - create/edit 必填 name（trim 后非空）；quota 与限速空 => 0，不得 NaN/负。
 * - expiresInDays 空 => 省略；填写则必须是正整数。
 * - edit 的 expiresAt 空字符串 => '' 清除；否则 date / datetime-local 按浏览器本地时区转 ISO，
 *   必须是真实存在且晚于当前时间的未来时间。
 * - IP 名单按换行 trim、去空行、去重，合法性交后端，不做残缺 IPv6 正则。
 * - 列表掩码长度 <= 12 为前 4 + ***，否则前 6 + ... + 后 4，不返回完整值。
 * - 分页 items 为空合法；pages 缺失按 ceil(total / page_size)。
 * - id 必须是正整数，不得把任意字符串拼进路径（id 注入）。
 * - 修改状态只提交 status，不带其它字段。
 * - create 带 Idempotency-Key，且不自动重试。
 */

import { describe, expect, it } from 'vitest';

import type { ApiRequestOptions, ApiRequester } from '../src/features/auth/types';
import { parseAvailableGroups, parseKeyPage, parseKeyRecord } from '../src/features/keys/adapter';
import {
  createKey,
  deleteKey,
  fetchAvailableGroups,
  fetchKeys,
  setKeyStatus,
  updateKey,
} from '../src/features/keys/api';
import type { KeyDraft } from '../src/features/keys/types';
import {
  buildKeyPayload,
  createEmptyKeyDraft,
  keyToDraft,
  maskKey,
} from '../src/features/keys/validation';

interface Call {
  path: string;
  options?: ApiRequestOptions;
}

function makeRequester(
  handler: (path: string, options?: ApiRequestOptions) => unknown = () => ({}),
): { request: ApiRequester; calls: Call[] } {
  const calls: Call[] = [];
  const request = ((path: string, options?: ApiRequestOptions) => {
    calls.push({ path, options });
    return Promise.resolve(handler(path, options));
  }) as unknown as ApiRequester;
  return { request, calls };
}

function firstCall(calls: Call[]): Call {
  const call = calls[0];
  if (!call) {
    throw new Error('requester 未被调用');
  }
  return call;
}

function draft(overrides: Partial<KeyDraft> = {}): KeyDraft {
  return { ...createEmptyKeyDraft(), name: 'my-key', ...overrides };
}

/** 后端 /keys 记录的最小合法形态，测试按需覆盖字段。 */
function keyRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    name: 'key-a',
    key: 'sk-abcdefghijklmnopqrstuvwxyz',
    status: 'active',
    group_id: 2,
    group: { id: 2, name: '默认分组' },
    quota: 0,
    quota_used: 0,
    expires_at: null,
    created_at: '2026-01-01T00:00:00Z',
    last_used_at: null,
    ip_whitelist: [],
    ip_blacklist: [],
    rate_limit_5h: 0,
    rate_limit_1d: 0,
    rate_limit_7d: 0,
    ...overrides,
  };
}

function payloadOf(call: Call): Record<string, unknown> {
  return call.options?.body as Record<string, unknown>;
}

describe('buildKeyPayload：create 必填与零不限', () => {
  it('name 只有空白时拒绝创建', () => {
    expect(() => buildKeyPayload(draft({ name: '   ' }), 'create')).toThrow();
  });

  it('name 前后空白会被 trim 后再提交', () => {
    const payload = buildKeyPayload(draft({ name: '  生产密钥  ' }), 'create');
    expect(payload.name).toBe('生产密钥');
  });

  it('quota 与三个限速留空都按 0（不限）提交', () => {
    const payload = buildKeyPayload(
      draft({ quota: '', limit5h: '', limit1d: '', limit7d: '' }),
      'create',
    );
    expect(payload.quota).toBe(0);
    expect(payload.rate_limit_5h).toBe(0);
    expect(payload.rate_limit_1d).toBe(0);
    expect(payload.rate_limit_7d).toBe(0);
  });

  it('显式填 0 仍表示不限，并原样提交数字 0', () => {
    const payload = buildKeyPayload(draft({ quota: '0', limit5h: '0' }), 'create');
    expect(payload.quota).toBe(0);
    expect(payload.rate_limit_5h).toBe(0);
  });

  it('正常数值原样转成数字', () => {
    const payload = buildKeyPayload(
      draft({ quota: '12.5', limit5h: '3', limit1d: '100', limit7d: '1000' }),
      'create',
    );
    expect(payload.quota).toBe(12.5);
    expect(payload.rate_limit_1d).toBe(100);
  });

  it('负数金额被拒绝', () => {
    expect(() => buildKeyPayload(draft({ quota: '-1' }), 'create')).toThrow();
    expect(() => buildKeyPayload(draft({ limit5h: '-0.5' }), 'create')).toThrow();
  });

  it('非数字金额（NaN 文本）被拒绝', () => {
    expect(() => buildKeyPayload(draft({ quota: 'abc' }), 'create')).toThrow();
    expect(() => buildKeyPayload(draft({ limit1d: 'NaN' }), 'create')).toThrow();
  });
});

describe('buildKeyPayload：expiresInDays 正整数', () => {
  it('留空时不提交 expires_in_days 字段', () => {
    const payload = buildKeyPayload(draft({ expiresInDays: '' }), 'create');
    expect(Object.prototype.hasOwnProperty.call(payload, 'expires_in_days')).toBe(false);
  });

  it('填写正整数时按数字提交', () => {
    const payload = buildKeyPayload(draft({ expiresInDays: '30' }), 'create');
    expect(payload.expires_in_days).toBe(30);
  });

  it('0、负数、小数与非数字都被拒绝', () => {
    expect(() => buildKeyPayload(draft({ expiresInDays: '0' }), 'create')).toThrow();
    expect(() => buildKeyPayload(draft({ expiresInDays: '-3' }), 'create')).toThrow();
    expect(() => buildKeyPayload(draft({ expiresInDays: '1.5' }), 'create')).toThrow();
    expect(() => buildKeyPayload(draft({ expiresInDays: 'abc' }), 'create')).toThrow();
    expect(() => buildKeyPayload(draft({ expiresInDays: 'NaN' }), 'create')).toThrow();
  });
});

describe('buildKeyPayload：分组与内部字段', () => {
  it('groupId 为 null 时允许提交 group_id: null', () => {
    const payload = buildKeyPayload(draft({ groupId: null }), 'create');
    expect(payload.group_id).toBeNull();
  });

  it('groupId 非正整数时拒绝', () => {
    expect(() => buildKeyPayload(draft({ groupId: 0 }), 'create')).toThrow();
    expect(() => buildKeyPayload(draft({ groupId: -1 }), 'create')).toThrow();
    expect(() => buildKeyPayload(draft({ groupId: 1.5 }), 'create')).toThrow();
  });

  it('create 不提交 expires_at，edit 不提交 expires_in_days', () => {
    const createPayload = buildKeyPayload(draft({ expiresAt: '2026-06-01T12:00' }), 'create');
    expect(Object.prototype.hasOwnProperty.call(createPayload, 'expires_at')).toBe(false);

    const editPayload = buildKeyPayload(draft({ expiresInDays: '30' }), 'edit');
    expect(Object.prototype.hasOwnProperty.call(editPayload, 'expires_in_days')).toBe(false);
  });
});

describe('buildKeyPayload：edit 的 expiresAt', () => {
  const now = new Date(2026, 0, 1, 12, 0, 0);

  it('空字符串表示清除，提交空字符串', () => {
    const payload = buildKeyPayload(draft({ expiresAt: '   ' }), 'edit', now);
    expect(payload.expires_at).toBe('');
  });

  it('datetime-local 按浏览器本地时区转成未来 ISO', () => {
    const payload = buildKeyPayload(draft({ expiresAt: '2026-06-01T12:00' }), 'edit', now);
    expect(payload.expires_at).toBe(new Date(2026, 5, 1, 12, 0, 0).toISOString());
  });

  it('仅日期（date）也按浏览器本地零点转成未来 ISO', () => {
    const payload = buildKeyPayload(draft({ expiresAt: '2026-06-01' }), 'edit', now);
    expect(payload.expires_at).toBe(new Date(2026, 5, 1, 0, 0, 0).toISOString());
  });

  it('不存在的日期（2026-02-30）被拒绝，不被静默滚动', () => {
    expect(() => buildKeyPayload(draft({ expiresAt: '2026-02-30T10:00' }), 'edit', now)).toThrow();
  });

  it('早于当前时间的过期时间被拒绝', () => {
    expect(() => buildKeyPayload(draft({ expiresAt: '2025-12-31T23:59' }), 'edit', now)).toThrow();
  });
});

describe('buildKeyPayload：IP 名单清洗', () => {
  it('按换行 trim、去空行并按首次出现去重', () => {
    const payload = buildKeyPayload(
      draft({ ipWhitelist: '  1.1.1.1 \n\n2.2.2.2\n1.1.1.1\r\n 3.3.3.3 \n' }),
      'create',
    );
    expect(payload.ip_whitelist).toEqual(['1.1.1.1', '2.2.2.2', '3.3.3.3']);
  });

  it('IPv6 等字符串原样交给后端，不做残缺正则', () => {
    const payload = buildKeyPayload(draft({ ipBlacklist: '::1\n2001:db8::/32' }), 'create');
    expect(payload.ip_blacklist).toEqual(['::1', '2001:db8::/32']);
  });

  it('全空名单提交空数组', () => {
    const payload = buildKeyPayload(draft({ ipWhitelist: '\n \n' }), 'create');
    expect(payload.ip_whitelist).toEqual([]);
  });
});

describe('maskKey 掩码规则', () => {
  it('长度 <= 12 时保留前 4 位加 ***', () => {
    expect(maskKey('abcdefghijkl')).toBe('abcd***');
    expect(maskKey('abc')).toBe('abc***');
  });

  it('长度 > 12 时保留前 6 与后 4，中间省略', () => {
    expect(maskKey('sk-1234567890abcdef')).toBe('sk-123...cdef');
  });

  it('长密钥掩码不暴露完整值', () => {
    const full = 'sk-abcdefghijklmnopqrstuvwxyz012345';
    const masked = maskKey(full);
    expect(masked).not.toBe(full);
    expect(masked).not.toContain(full);
    expect(masked.length).toBeLessThan(full.length);
  });
});

describe('keyToDraft 回填', () => {
  it('只回填表单字段，不透传内部字段', () => {
    const record = parseKeyRecord(
      keyRecord({ user_id: 9, usage_5h: 5, current_concurrency: 3, concurrency_limit: 10 }),
    );
    const result = keyToDraft(record);
    expect(Object.keys(result).sort()).toEqual(
      [
        'expiresAt',
        'expiresInDays',
        'groupId',
        'ipBlacklist',
        'ipWhitelist',
        'limit1d',
        'limit5h',
        'limit7d',
        'name',
        'quota',
      ].sort(),
    );
    expect(result).not.toHaveProperty('user_id');
    expect(result).not.toHaveProperty('current_concurrency');
  });

  it('额度 0（不限）回填为空字符串，避免误显示为 0 额度', () => {
    const result = keyToDraft(parseKeyRecord(keyRecord({ quota: 0, rate_limit_5h: 0 })));
    expect(result.quota).toBe('');
    expect(result.limit5h).toBe('');
  });

  it('保留合法分组，不擅自清空', () => {
    const result = keyToDraft(parseKeyRecord(keyRecord({ group_id: 7 })));
    expect(result.groupId).toBe(7);
  });

  it('expiresAt 为 null 时回填空字符串', () => {
    const result = keyToDraft(parseKeyRecord(keyRecord({ expires_at: null })));
    expect(result.expiresAt).toBe('');
  });
});

describe('parseKeyRecord 严格校验', () => {
  it('group 缺失或为 null 时 groupName 为 null', () => {
    expect(parseKeyRecord(keyRecord({ group: null, group_id: null })).groupName).toBeNull();
    const { group, ...withoutGroup } = keyRecord();
    void group;
    expect(parseKeyRecord(withoutGroup).groupName).toBeNull();
  });

  it('缺失必填字段或类型错误时抛错', () => {
    const { name, ...withoutName } = keyRecord();
    void name;
    expect(() => parseKeyRecord(withoutName)).toThrow();
    expect(() => parseKeyRecord(keyRecord({ id: '1' }))).toThrow();
    expect(() => parseKeyRecord(keyRecord({ quota: -1 }))).toThrow();
    expect(() => parseKeyRecord(keyRecord({ quota: Number.NaN }))).toThrow();
  });

  it('expires_at / last_used_at 允许 null', () => {
    const record = parseKeyRecord(keyRecord({ expires_at: null, last_used_at: null }));
    expect(record.expiresAt).toBeNull();
    expect(record.lastUsedAt).toBeNull();
  });

  it('内部额外字段不进入结果', () => {
    const record = parseKeyRecord(keyRecord({ user_id: 1, usage_1d: 2 }));
    expect(Object.keys(record)).not.toContain('user_id');
    expect(Object.keys(record)).not.toContain('usage_1d');
  });
});

describe('parseKeyPage 分页', () => {
  it('空列表合法', () => {
    const result = parseKeyPage({ items: [], total: 0, page: 1, page_size: 20 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.pages).toBe(0);
  });

  it('pages 缺失时按 ceil(total / page_size) 补齐', () => {
    const result = parseKeyPage({
      items: [keyRecord({ id: 1 }), keyRecord({ id: 2 })],
      total: 45,
      page: 2,
      page_size: 20,
    });
    expect(result.pages).toBe(3);
    expect(result.items).toHaveLength(2);
  });

  it('后端给了 pages 时原样保留', () => {
    const result = parseKeyPage({ items: [], total: 100, page: 1, page_size: 10, pages: 10 });
    expect(result.pages).toBe(10);
  });

  it('items 不是数组时抛错', () => {
    expect(() => parseKeyPage({ items: 'nope', total: 0, page: 1, page_size: 10 })).toThrow();
  });
});

describe('parseAvailableGroups 保留授权分组', () => {
  it('数组元素全部保留 id/name/platform/subscription_type', () => {
    const groups = parseAvailableGroups([
      { id: 1, name: '默认', platform: 'openai', subscription_type: 'standard' },
      { id: 2, name: '企业', platform: 'anthropic', subscription_type: 'enterprise' },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[1]).toEqual({
      id: 2,
      name: '企业',
      platform: 'anthropic',
      subscriptionType: 'enterprise',
    });
  });

  it('元素缺字段时抛错', () => {
    expect(() => parseAvailableGroups([{ id: 1, name: 'x' }])).toThrow();
  });
});

describe('keys api 请求边界（mock，无真实请求）', () => {
  it('fetchKeys 请求固定路径并带上分页与过滤参数', async () => {
    const { request, calls } = makeRequester(() => ({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    }));
    await fetchKeys(request, { page: 1, pageSize: 20, search: ' prod ', status: 'active' });
    const call = firstCall(calls);
    expect(call.options?.method).toBe('GET');
    const url = new URL(call.path, 'https://portal.example.com');
    expect(url.pathname).toBe('/keys');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('page_size')).toBe('20');
    expect(url.searchParams.get('search')).toBe('prod');
    expect(url.searchParams.get('status')).toBe('active');
  });

  it('fetchAvailableGroups 请求 /groups/available', async () => {
    const { request, calls } = makeRequester(() => []);
    await fetchAvailableGroups(request);
    expect(firstCall(calls).path).toBe('/groups/available');
    expect(firstCall(calls).options?.method).toBe('GET');
  });

  it('createKey 带一次 Idempotency-Key 且提交 create 载荷', async () => {
    const { request, calls } = makeRequester(() => keyRecord());
    await createKey(request, draft({ name: '新密钥', expiresInDays: '7' }));
    const call = firstCall(calls);
    expect(call.path).toBe('/keys');
    expect(call.options?.method).toBe('POST');
    const idempotencyKey = call.options?.headers?.['Idempotency-Key'];
    expect(typeof idempotencyKey).toBe('string');
    expect(idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    const payload = payloadOf(call);
    expect(payload.name).toBe('新密钥');
    expect(payload.expires_in_days).toBe(7);
    expect(payload).not.toHaveProperty('expires_at');
  });

  it('createKey 失败（如超时）不隐式重试，只发一次请求', async () => {
    const { request, calls } = makeRequester(() => {
      throw new Error('timeout');
    });
    await expect(createKey(request, draft())).rejects.toThrow('timeout');
    expect(calls).toHaveLength(1);
  });

  it('updateKey 拒绝非正整数 id，不发起请求（id 注入防护）', async () => {
    const { request, calls } = makeRequester(() => keyRecord());
    for (const badId of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(updateKey(request, badId, draft())).rejects.toThrow();
    }
    await expect(updateKey(request, '1/../admin' as unknown as number, draft())).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('deleteKey 拒绝非正整数 id，不发起请求', async () => {
    const { request, calls } = makeRequester(() => ({}));
    await expect(deleteKey(request, 0)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it('setKeyStatus 只提交 status，不带额度/分组等字段', async () => {
    const { request, calls } = makeRequester(() => ({}));
    await setKeyStatus(request, 3, 'inactive');
    const call = firstCall(calls);
    expect(call.path).toBe('/keys/3');
    expect(call.options?.method).toBe('PUT');
    expect(call.options?.body).toEqual({ status: 'inactive' });
  });

  it('updateKey 提交 edit 载荷（expires_at 清除语义）', async () => {
    const { request, calls } = makeRequester(() => keyRecord());
    await updateKey(request, 5, draft({ expiresAt: '' }));
    const call = firstCall(calls);
    expect(call.path).toBe('/keys/5');
    expect(call.options?.method).toBe('PUT');
    expect(payloadOf(call).expires_at).toBe('');
    expect(payloadOf(call)).not.toHaveProperty('expires_in_days');
  });

  it('deleteKey 使用 DELETE /keys/:id', async () => {
    const { request, calls } = makeRequester(() => ({}));
    await deleteKey(request, 9);
    expect(firstCall(calls).path).toBe('/keys/9');
    expect(firstCall(calls).options?.method).toBe('DELETE');
  });
});
