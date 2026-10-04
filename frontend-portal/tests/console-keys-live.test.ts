import { describe, expect, it } from 'vitest';

import {
  consoleDate,
  daysBetween,
  draftFromKey,
  emptyDraft,
  expiryPresetOf,
  quotaRatio,
  toCreateInput,
  toUpdateInput,
  validateDraft,
  type KeyDraft,
} from '@/blocks/console/keys/keys-model';
import { customKeyError, nameError, parseAmount, parseIpList } from '@/lib/console/live/keys-rules';
import type { LiveKey } from '@/lib/console/live/keys-types';
import {
  consoleToday,
  keyErrorFor,
  keyErrorStatus,
  keysListPath,
  keyUsageFrom,
  keyUsagePath,
  parseCreateInput,
  parseKeysQuery,
  parseUpdateInput,
  toCreatePayload,
  toGroupRates,
  toKeyGroupOptions,
  toKeysPage,
  toLiveKey,
  toUpdatePayload,
} from '@/lib/server/sub2api/api-keys';

const TODAY = '2026-10-04';

/** 后端一把密钥（字段名照后端） */
const RAW_KEY = {
  id: 7,
  user_id: 2,
  key: 'sk-full-secret-0123456789',
  name: '开发调试',
  group_id: 3,
  status: 'active',
  ip_whitelist: ['203.0.113.5'],
  ip_blacklist: [],
  quota: 50,
  quota_used: 12.5,
  expires_at: '2026-12-31T15:59:59Z',
  created_at: '2026-09-14T02:00:00Z',
  rate_limit_5h: 5,
  rate_limit_1d: 0,
  rate_limit_7d: 30,
  usage_5h: 1.25,
  usage_1d: 2,
  usage_7d: 8,
  group: { id: 3, name: '标准分组', rate_multiplier: 0.3 },
};

const live = toLiveKey(RAW_KEY, new Map(), null) as LiveKey;

describe('密钥的输入规则', () => {
  it('名称不能空，最长 100 字节（中文一个字 3 字节）', () => {
    expect(nameError('  ')).toBe('required');
    expect(nameError('键'.repeat(33))).toBeNull();
    expect(nameError('键'.repeat(34))).toBe('tooLong');
    expect(nameError('a'.repeat(100))).toBeNull();
  });

  it('自定义密钥 16–128 位，只能用字母、数字、下划线、连字符', () => {
    expect(customKeyError('')).toBe('required');
    expect(customKeyError('short-key')).toBe('tooShort');
    expect(customKeyError('a'.repeat(129))).toBe('tooLong');
    expect(customKeyError('has space in the key!!')).toBe('invalidChars');
    expect(customKeyError('my_custom-key_123456')).toBeNull();
  });

  it('金额：空着是 0（不限），负数、不是数字、太大都不行', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('-1')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('2000000')).toBeNull();
  });

  it('IP 名单：一行一个，空行不算，网段和 IPv6 都行，有一行不像 IP 就不收', () => {
    expect(parseIpList('203.0.113.5\n\n10.0.0.0/8\n2001:db8::/32\n')).toEqual([
      '203.0.113.5',
      '10.0.0.0/8',
      '2001:db8::/32',
    ]);
    expect(parseIpList('')).toEqual([]);
    expect(parseIpList('203.0.113.5\nexample.com')).toBeNull();
    // 只由十六进制字母组成的词不是 IP
    expect(parseIpList('cafe')).toBeNull();
    expect(parseIpList('::1')).toEqual(['::1']);
    expect(parseIpList(Array.from({ length: 101 }, () => '10.0.0.1').join('\n'))).toBeNull();
  });
});

describe('密钥列表与用量', () => {
  it('查询参数：页码从 1 开始，每页条数只认分页组件的几档，状态只认四种', () => {
    expect(parseKeysQuery(new URLSearchParams(''))).toEqual({
      page: 1,
      pageSize: 20,
      search: '',
      status: 'all',
    });
    expect(
      parseKeysQuery(new URLSearchParams('page=2&pageSize=50&search= 调试 &status=expired')),
    ).toEqual({
      page: 2,
      pageSize: 50,
      search: '调试',
      status: 'expired',
    });
    expect(parseKeysQuery(new URLSearchParams('pageSize=33'))).toBeNull();
    expect(parseKeysQuery(new URLSearchParams('status=paused'))).toBeNull();
  });

  it('后端列表地址：新建的在前，带搜索与状态', () => {
    const url = new URL(
      `http://x${keysListPath({ page: 2, pageSize: 20, search: 'prod', status: 'inactive' })}`,
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      page_size: '20',
      sort_by: 'created_at',
      sort_order: 'desc',
      search: 'prod',
      status: 'inactive',
    });
  });

  it('今天按北京时间；用量取近 30 天（含今天）按天按密钥', () => {
    expect(consoleToday(new Date('2026-10-03T16:30:00Z'))).toBe('2026-10-04');
    const url = new URL(`http://x${keyUsagePath(TODAY)}`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      start_date: '2026-09-05',
      end_date: TODAY,
      granularity: 'day',
      dimensions: 'api_key',
      timezone: 'Asia/Shanghai',
    });
  });

  it('每把密钥的近 30 天与今天：按天加总；看不懂的总览给 null', () => {
    const overview = {
      start_date: '2026-09-05',
      end_date: TODAY,
      granularity: 'day',
      summary: {},
      buckets: [],
      api_keys: [
        {
          bucket: '2026-09-27',
          id: 7,
          name: '开发调试',
          requests: 10,
          total_tokens: 1,
          actual_cost: 1.5,
        },
        { bucket: TODAY, id: 7, name: '开发调试', requests: 2, total_tokens: 1, actual_cost: 0.25 },
        { bucket: TODAY, id: 8, name: '测试', requests: 1, total_tokens: 1, actual_cost: 0.1 },
      ],
    };
    const usage = keyUsageFrom(overview, TODAY);
    expect(usage?.get(7)).toEqual({
      last30: { requests: 12, costUsd: 1.75 },
      today: { requests: 2, costUsd: 0.25 },
    });
    expect(usage?.get(8)?.today.requests).toBe(1);
    expect(keyUsageFrom({ nope: true }, TODAY)).toBeNull();
  });

  it('后端密钥 → 页面一行：完整密钥保留，分组倍率换成账号专属倍率，没用量的是 0', () => {
    const row = toLiveKey(RAW_KEY, toGroupRates({ 3: 0.15 }), new Map());
    expect(row).toMatchObject({
      id: 7,
      secret: 'sk-full-secret-0123456789',
      group: { id: 3, name: '标准分组', rate: 0.15 },
      status: 'active',
      quota: 50,
      quotaUsed: 12.5,
      rateLimits: { h5: 5, d1: 0, d7: 30 },
      rateUsage: { h5: 1.25, d1: 2, d7: 8 },
      usage: { last30: { requests: 0, costUsd: 0 }, today: { requests: 0, costUsd: 0 } },
    });
    expect(live.group?.rate).toBe(0.3);
    expect(live.usage).toBeNull();
    expect(toLiveKey({ ...RAW_KEY, status: 'weird' }, new Map(), null)?.status).toBe('inactive');
    expect(toLiveKey({ ...RAW_KEY, key: '' }, new Map(), null)).toBeNull();
    expect(
      toKeysPage(
        { items: [RAW_KEY, { id: 'x' }], total: 1, page: 1, page_size: 20 },
        new Map(),
        null,
      )?.items,
    ).toHaveLength(1);
  });

  it('能用的分组：沿用后端顺序，倍率按账号专属倍率', () => {
    expect(
      toKeyGroupOptions(
        [
          { id: 3, name: '标准分组', description: '日常用', rate_multiplier: 0.3 },
          { id: 5, name: '高性能分组', rate_multiplier: 1 },
        ],
        toGroupRates({ 5: 0.8, bad: 1 }),
      ),
    ).toEqual([
      { id: 3, name: '标准分组', description: '日常用', rate: 0.3 },
      { id: 5, name: '高性能分组', description: '', rate: 0.8 },
    ]);
    expect(toKeyGroupOptions(null, new Map())).toBeNull();
  });
});

describe('创建与修改的请求', () => {
  const create = {
    name: ' 生产 ',
    groupId: 3,
    customKey: 'my_custom-key_123456',
    ipWhitelist: ['203.0.113.5'],
    ipBlacklist: [],
    quota: 20,
    expiresInDays: 30,
    rateLimits: { h5: 5, d1: 0, d7: 0 },
  };

  it('创建：校验后照 sub2api 转成后端请求体，空名单、0 额度、0 限速、永久都不带', () => {
    const input = parseCreateInput(create);
    expect(input?.name).toBe('生产');
    expect(toCreatePayload(input!)).toEqual({
      name: '生产',
      group_id: 3,
      custom_key: 'my_custom-key_123456',
      ip_whitelist: ['203.0.113.5'],
      quota: 20,
      expires_in_days: 30,
      rate_limit_5h: 5,
    });
    const minimal = parseCreateInput({ name: 'a', groupId: 3 });
    expect(toCreatePayload(minimal!)).toEqual({ name: 'a', group_id: 3 });
  });

  it('创建：名称、分组、自定义密钥、名单、金额、天数有一项不对就不收', () => {
    expect(parseCreateInput({ ...create, name: '' })).toBeNull();
    expect(parseCreateInput({ ...create, groupId: 0 })).toBeNull();
    expect(parseCreateInput({ ...create, customKey: 'short' })).toBeNull();
    expect(parseCreateInput({ ...create, ipWhitelist: ['example.com'] })).toBeNull();
    expect(parseCreateInput({ ...create, quota: -1 })).toBeNull();
    expect(parseCreateInput({ ...create, expiresInDays: 0 })).toBeNull();
    expect(parseCreateInput({ ...create, rateLimits: { h5: 1 } })).toBeNull();
  });

  it('修改：只带给了的项；限速摊成三项；清零写成后端的开关；空串改成永久', () => {
    const input = parseUpdateInput({
      status: 'inactive',
      expiresAt: '',
      rateLimits: { h5: 0, d1: 3, d7: 0 },
      resetQuota: true,
    });
    expect(toUpdatePayload(input!)).toEqual({
      status: 'inactive',
      expires_at: '',
      rate_limit_5h: 0,
      rate_limit_1d: 3,
      rate_limit_7d: 0,
      reset_quota: true,
    });
    expect(toUpdatePayload(parseUpdateInput({ resetRateUsage: true })!)).toEqual({
      reset_rate_limit_usage: true,
    });
  });

  it('修改：什么都没给、状态不对、时间看不懂、清零不是 true 都不收', () => {
    expect(parseUpdateInput({})).toBeNull();
    expect(parseUpdateInput({ status: 'expired' })).toBeNull();
    expect(parseUpdateInput({ expiresAt: 'tomorrow' })).toBeNull();
    expect(parseUpdateInput({ resetQuota: false })).toBeNull();
    expect(parseUpdateInput({ name: 'ok', unknown: 1 })).toEqual({ name: 'ok' });
  });

  it('后端错误 → 失败原因与状态码', () => {
    const error = (status: number, reason = '') => ({ status, reason, message: '' });
    expect(keyErrorFor(error(409, 'API_KEY_EXISTS'))).toBe('key_exists');
    expect(keyErrorFor(error(400, 'INVALID_IP_PATTERN'))).toBe('invalid_ip');
    expect(keyErrorFor(error(403, 'GROUP_NOT_ALLOWED'))).toBe('group_not_allowed');
    expect(keyErrorFor(error(403))).toBe('forbidden');
    expect(keyErrorFor(error(404))).toBe('not_found');
    expect(keyErrorFor(error(429))).toBe('too_many');
    expect(keyErrorFor(error(502))).toBe('unavailable');
    expect(keyErrorFor(error(400))).toBe('invalid');
    expect(keyErrorStatus('key_exists')).toBe(409);
    expect(keyErrorStatus('unavailable')).toBe(503);
  });
});

describe('密钥表单', () => {
  const groups = [{ id: 3, name: '标准分组', description: '', rate: 0.3 }];
  const filled = (patch: Partial<KeyDraft> = {}): KeyDraft => ({
    ...emptyDraft(TODAY, groups),
    name: '生产',
    ...patch,
  });

  it('只有一个分组时直接选上，多个时要自己选；有效期默认 30 天后', () => {
    expect(emptyDraft(TODAY, groups)).toMatchObject({ groupId: 3, expiryDate: '2026-11-03' });
    expect(emptyDraft(TODAY, [...groups, { ...groups[0]!, id: 5 }]).groupId).toBeNull();
  });

  it('校验：分组必填；自定义密钥只在创建时查；关着的开关下面不查', () => {
    expect(validateDraft(filled({ groupId: null }), 'create', TODAY)).toEqual({
      group: 'required',
    });
    const custom = filled({ useCustomKey: true, customKey: 'short' });
    expect(validateDraft(custom, 'create', TODAY)).toEqual({ customKey: 'tooShort' });
    expect(validateDraft(custom, 'edit', TODAY)).toEqual({});
    expect(validateDraft(filled({ ipWhitelist: 'bad' }), 'create', TODAY)).toEqual({});
    expect(validateDraft(filled({ ipLimit: true, ipWhitelist: 'bad' }), 'create', TODAY)).toEqual({
      ipWhitelist: 'invalid',
    });
    expect(validateDraft(filled({ rateLimit: true, rate1d: '-2' }), 'create', TODAY)).toEqual({
      rate1d: 'invalid',
    });
  });

  it('有效期：新建要晚于今天，编辑不早于今天，最长 10 年', () => {
    const on = (expiryDate: string) => filled({ expiry: true, expiryDate });
    expect(validateDraft(on(TODAY), 'create', TODAY)).toEqual({ expiryDate: 'past' });
    expect(validateDraft(on(TODAY), 'edit', TODAY)).toEqual({});
    expect(validateDraft(on('2036-10-05'), 'create', TODAY)).toEqual({ expiryDate: 'tooFar' });
    expect(validateDraft(on('not-a-date'), 'create', TODAY)).toEqual({ expiryDate: 'invalid' });
  });

  it('创建请求：有效期换成天数，关着的开关一律当没设', () => {
    expect(
      toCreateInput(
        filled({
          ipWhitelist: '10.0.0.1',
          quota: '20',
          rateLimit: true,
          rate5h: '5',
          expiry: true,
          expiryDate: '2026-10-11',
        }),
        TODAY,
      ),
    ).toEqual({
      name: '生产',
      groupId: 3,
      customKey: null,
      ipWhitelist: [],
      ipBlacklist: [],
      quota: 20,
      expiresInDays: 7,
      rateLimits: { h5: 5, d1: 0, d7: 0 },
    });
  });

  it('修改请求：有效期只在改过时才带，改成永久是空串，新日期写成北京时间那天结束', () => {
    const draft = draftFromKey(live, TODAY);
    expect(draft).toMatchObject({
      groupId: 3,
      ipLimit: true,
      ipWhitelist: '203.0.113.5',
      quota: '50',
      rateLimit: true,
      rate5h: '5',
      rate1d: '',
      expiry: true,
      expiryDate: '2026-12-31',
    });
    expect(toUpdateInput(draft, live).expiresAt).toBeUndefined();
    expect(toUpdateInput({ ...draft, expiry: false }, live).expiresAt).toBe('');
    expect(toUpdateInput({ ...draft, expiryDate: '2027-01-31' }, live)).toMatchObject({
      expiresAt: '2027-01-31T23:59:59+08:00',
      groupId: 3,
      quota: 50,
      rateLimits: { h5: 5, d1: 0, d7: 30 },
      ipWhitelist: ['203.0.113.5'],
    });
  });

  it('日期与额度的小工具', () => {
    expect(daysBetween('2026-10-04', '2026-11-03')).toBe(30);
    expect(consoleDate('2026-12-31T15:59:59Z')).toBe('2026-12-31');
    expect(expiryPresetOf(TODAY, '2026-10-11')).toBe(7);
    expect(expiryPresetOf(TODAY, '2026-10-12')).toBe('custom');
    expect(quotaRatio({ quota: 0, quotaUsed: 5 })).toBeNull();
    expect(quotaRatio({ quota: 50, quotaUsed: 12.5 })).toBe(0.25);
    expect(quotaRatio({ quota: 10, quotaUsed: 15 })).toBe(1);
  });
});
