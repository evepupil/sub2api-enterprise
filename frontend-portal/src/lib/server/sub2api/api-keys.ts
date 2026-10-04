import {
  KEY_STATUSES,
  type KeyCreateInput,
  type KeyErrorReason,
  type KeyGroupOption,
  type KeysPageData,
  type KeysQuery,
  type KeyUpdateInput,
  type KeyUsage,
  type KeyWindows,
  type LiveKey,
} from '@/lib/console/live/keys-types';
import {
  customKeyError,
  IP_LIST_MAX,
  isIpEntry,
  isValidAmount,
  isValidExpiryDays,
  nameError,
} from '@/lib/console/live/keys-rules';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '@/lib/console/pagination';
import { addDays } from '@/lib/console/time';

import { CONSOLE_TIMEZONE } from './date-range';
import type { BackendError } from './envelope';
import { toUsageOverview } from './usage-overview';

/**
 * 控制台密钥页的后端接口：查询参数与请求体的校验、拼后端地址与请求体、把后端结果换成浏览器用的形状、
 * 错误归类。纯函数，单测锁住。后端接口：/keys（列表、创建）、/keys/:id（修改、删除）、
 * /groups/available（能用的分组）、/groups/rates（账号的专属倍率）、/usage/dashboard/overview（每把密钥的用量）。
 */

export const KEYS_PATH = '/keys';
export const AVAILABLE_GROUPS_PATH = '/groups/available';
export const GROUP_RATES_PATH = '/groups/rates';

export const keyPath = (id: number) => `${KEYS_PATH}/${id}`;

/** 后端搜索词最长 100 个字符 */
const SEARCH_MAX = 100;

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const amount = (value: unknown): number => {
  const parsed = num(value);
  return parsed !== null && parsed > 0 ? parsed : 0;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const positiveId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** 浏览器传来的 ?page&pageSize&search&status；不合法时返回 null */
export function parseKeysQuery(params: URLSearchParams): KeysQuery | null {
  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? String(DEFAULT_PAGE_SIZE));
  if (!Number.isSafeInteger(page) || page < 1) return null;
  if (!PAGE_SIZES.includes(pageSize)) return null;
  const search = (params.get('search') ?? '').trim();
  if (search.length > SEARCH_MAX) return null;
  const statusParam = params.get('status') ?? 'all';
  const status =
    statusParam === 'all' ? 'all' : KEY_STATUSES.find((value) => value === statusParam);
  if (!status) return null;
  return { page, pageSize, search, status };
}

/** 后端密钥列表：新建的在前 */
export function keysListPath(query: KeysQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  if (query.search) params.set('search', query.search);
  if (query.status !== 'all') params.set('status', query.status);
  return `${KEYS_PATH}?${params.toString()}`;
}

/** 北京时间的今天（YYYY-MM-DD） */
export function consoleToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CONSOLE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** 每把密钥的用量：用量总览接口按天 × 密钥给近 30 天（含今天） */
export function keyUsagePath(today: string): string {
  const params = new URLSearchParams({
    start_date: addDays(today, -29),
    end_date: today,
    timezone: CONSOLE_TIMEZONE,
    granularity: 'day',
    dimensions: 'api_key',
  });
  return `/usage/dashboard/overview?${params.toString()}`;
}

const emptyUsage = (): KeyUsage => ({
  last30: { requests: 0, costUsd: 0 },
  today: { requests: 0, costUsd: 0 },
});

/** 用量总览 → 每把密钥近 30 天与今天的次数和花费；看不懂时返回 null */
export function keyUsageFrom(raw: unknown, today: string): Map<number, KeyUsage> | null {
  const overview = toUsageOverview(raw);
  if (!overview) return null;
  const usage = new Map<number, KeyUsage>();
  for (const point of overview.series.key) {
    const id = Number(point.id);
    if (!positiveId(id)) continue;
    const entry = usage.get(id) ?? emptyUsage();
    entry.last30.requests += point.requests;
    entry.last30.costUsd += point.costUsd;
    if (point.bucket === today) {
      entry.today.requests += point.requests;
      entry.today.costUsd += point.costUsd;
    }
    usage.set(id, entry);
  }
  return usage;
}

/** 账号的专属倍率（分组 ID → 倍率）；读不到时为空 */
export function toGroupRates(raw: unknown): Map<number, number> {
  const rates = new Map<number, number>();
  if (!isRecord(raw)) return rates;
  for (const [key, value] of Object.entries(raw)) {
    const id = Number(key);
    const rate = num(value);
    if (positiveId(id) && rate !== null && rate >= 0) rates.set(id, rate);
  }
  return rates;
}

/** 后端一把密钥 → 页面上的一行；缺了 ID、密钥或创建时间时返回 null */
export function toLiveKey(
  raw: unknown,
  rates: ReadonlyMap<number, number>,
  usage: ReadonlyMap<number, KeyUsage> | null,
): LiveKey | null {
  if (!isRecord(raw)) return null;
  const id = num(raw.id);
  const secret = text(raw.key);
  const createdAt = text(raw.created_at);
  if (id === null || secret === null || createdAt === null) return null;

  const groupId = num(raw.group_id);
  const group = isRecord(raw.group) ? raw.group : null;
  return {
    id,
    name: text(raw.name) ?? `#${id}`,
    secret,
    group:
      groupId === null
        ? null
        : {
            id: groupId,
            name: (group && text(group.name)) ?? `#${groupId}`,
            rate: rates.get(groupId) ?? (group ? num(group.rate_multiplier) : null) ?? 1,
          },
    // 认不出的状态按「已暂停」处理：至少不会被当成能用的密钥
    status: KEY_STATUSES.find((value) => value === raw.status) ?? 'inactive',
    ipWhitelist: strings(raw.ip_whitelist),
    ipBlacklist: strings(raw.ip_blacklist),
    quota: amount(raw.quota),
    quotaUsed: amount(raw.quota_used),
    expiresAt: text(raw.expires_at),
    createdAt,
    rateLimits: {
      h5: amount(raw.rate_limit_5h),
      d1: amount(raw.rate_limit_1d),
      d7: amount(raw.rate_limit_7d),
    },
    rateUsage: { h5: amount(raw.usage_5h), d1: amount(raw.usage_1d), d7: amount(raw.usage_7d) },
    usage: usage === null ? null : (usage.get(id) ?? emptyUsage()),
  };
}

/** 后端分页结果 → 一页密钥；看不懂时返回 null */
export function toKeysPage(
  raw: unknown,
  rates: ReadonlyMap<number, number>,
  usage: ReadonlyMap<number, KeyUsage> | null,
): KeysPageData | null {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;
  return {
    items: raw.items
      .map((item) => toLiveKey(item, rates, usage))
      .filter((key): key is LiveKey => key !== null),
    total: num(raw.total) ?? 0,
    page: num(raw.page) ?? 1,
    pageSize: num(raw.page_size) ?? DEFAULT_PAGE_SIZE,
  };
}

/** 能用的分组（沿用后端顺序），倍率按账号的专属倍率；看不懂时返回 null */
export function toKeyGroupOptions(
  raw: unknown,
  rates: ReadonlyMap<number, number>,
): KeyGroupOption[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter(isRecord).flatMap((group) => {
    const id = num(group.id);
    if (id === null) return [];
    return [
      {
        id,
        name: text(group.name) ?? `#${id}`,
        description: text(group.description) ?? '',
        rate: rates.get(id) ?? num(group.rate_multiplier) ?? 1,
      },
    ];
  });
}

/** 名单：没给是空名单；不是字符串数组、有不像 IP 的条目或太长时返回 null */
function ipList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > IP_LIST_MAX) return null;
  const entries = value.map((item) => (typeof item === 'string' ? item.trim() : ''));
  return entries.every(isIpEntry) ? entries : null;
}

/** 三个限速窗口：没给都是 0（不限）；有一项不合法时返回 null */
function windows(value: unknown): KeyWindows | null {
  if (value === undefined) return { h5: 0, d1: 0, d7: 0 };
  if (!isRecord(value)) return null;
  const { h5, d1, d7 } = value;
  return isValidAmount(h5) && isValidAmount(d1) && isValidAmount(d7) ? { h5, d1, d7 } : null;
}

/** 创建请求体：{ name, groupId, customKey?, ipWhitelist?, ipBlacklist?, quota?, expiresInDays?, rateLimits? } */
export function parseCreateInput(body: Record<string, unknown>): KeyCreateInput | null {
  if (typeof body.name !== 'string' || nameError(body.name)) return null;
  if (!positiveId(body.groupId)) return null;

  let customKey: string | null = null;
  if (body.customKey !== undefined && body.customKey !== null) {
    if (typeof body.customKey !== 'string' || customKeyError(body.customKey)) return null;
    customKey = body.customKey.trim();
  }

  const ipWhitelist = ipList(body.ipWhitelist);
  const ipBlacklist = ipList(body.ipBlacklist);
  const quota = body.quota ?? 0;
  const rateLimits = windows(body.rateLimits);
  if (!ipWhitelist || !ipBlacklist || !isValidAmount(quota) || !rateLimits) return null;

  let expiresInDays: number | null = null;
  if (body.expiresInDays !== undefined && body.expiresInDays !== null) {
    if (!isValidExpiryDays(body.expiresInDays)) return null;
    expiresInDays = body.expiresInDays;
  }

  return {
    name: body.name.trim(),
    groupId: body.groupId,
    customKey,
    ipWhitelist,
    ipBlacklist,
    quota,
    expiresInDays,
    rateLimits,
  };
}

/** 修改请求体：只认下面这些项，至少要有一项；有一项不合法就整个不收 */
export function parseUpdateInput(body: Record<string, unknown>): KeyUpdateInput | null {
  const input: KeyUpdateInput = {};
  if ('name' in body) {
    if (typeof body.name !== 'string' || nameError(body.name)) return null;
    input.name = body.name.trim();
  }
  if ('groupId' in body) {
    if (!positiveId(body.groupId)) return null;
    input.groupId = body.groupId;
  }
  if ('status' in body) {
    if (body.status !== 'active' && body.status !== 'inactive') return null;
    input.status = body.status;
  }
  for (const field of ['ipWhitelist', 'ipBlacklist'] as const) {
    if (field in body) {
      const list = ipList(body[field]);
      if (!list) return null;
      input[field] = list;
    }
  }
  if ('quota' in body) {
    if (!isValidAmount(body.quota)) return null;
    input.quota = body.quota;
  }
  if ('expiresAt' in body) {
    const value = body.expiresAt;
    if (typeof value !== 'string' || (value !== '' && Number.isNaN(Date.parse(value)))) return null;
    input.expiresAt = value;
  }
  if ('rateLimits' in body) {
    const value = windows(body.rateLimits);
    if (!value) return null;
    input.rateLimits = value;
  }
  if ('resetQuota' in body) {
    if (body.resetQuota !== true) return null;
    input.resetQuota = true;
  }
  if ('resetRateUsage' in body) {
    if (body.resetRateUsage !== true) return null;
    input.resetRateUsage = true;
  }
  return Object.keys(input).length > 0 ? input : null;
}

/** 创建 → 后端请求体：和 sub2api 一样，空名单、0 额度、0 限速、永久都不带 */
export function toCreatePayload(input: KeyCreateInput): RawRecord {
  const payload: RawRecord = { name: input.name, group_id: input.groupId };
  if (input.customKey) payload.custom_key = input.customKey;
  if (input.ipWhitelist.length > 0) payload.ip_whitelist = input.ipWhitelist;
  if (input.ipBlacklist.length > 0) payload.ip_blacklist = input.ipBlacklist;
  if (input.quota > 0) payload.quota = input.quota;
  if (input.expiresInDays !== null) payload.expires_in_days = input.expiresInDays;
  if (input.rateLimits.h5 > 0) payload.rate_limit_5h = input.rateLimits.h5;
  if (input.rateLimits.d1 > 0) payload.rate_limit_1d = input.rateLimits.d1;
  if (input.rateLimits.d7 > 0) payload.rate_limit_7d = input.rateLimits.d7;
  return payload;
}

/** 修改 → 后端请求体：只带要改的项（后端把没带的项当作不改） */
export function toUpdatePayload(input: KeyUpdateInput): RawRecord {
  const payload: RawRecord = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.groupId !== undefined) payload.group_id = input.groupId;
  if (input.status !== undefined) payload.status = input.status;
  if (input.ipWhitelist !== undefined) payload.ip_whitelist = input.ipWhitelist;
  if (input.ipBlacklist !== undefined) payload.ip_blacklist = input.ipBlacklist;
  if (input.quota !== undefined) payload.quota = input.quota;
  if (input.expiresAt !== undefined) payload.expires_at = input.expiresAt;
  if (input.rateLimits !== undefined) {
    payload.rate_limit_5h = input.rateLimits.h5;
    payload.rate_limit_1d = input.rateLimits.d1;
    payload.rate_limit_7d = input.rateLimits.d7;
  }
  if (input.resetQuota) payload.reset_quota = true;
  if (input.resetRateUsage) payload.reset_rate_limit_usage = true;
  return payload;
}

/** 后端错误 → 页面上的失败原因 */
export function keyErrorFor(error: BackendError): KeyErrorReason {
  switch (error.reason) {
    case 'API_KEY_EXISTS':
      return 'key_exists';
    case 'API_KEY_TOO_SHORT':
      return 'key_too_short';
    case 'API_KEY_INVALID_CHARS':
      return 'key_invalid_chars';
    case 'INVALID_IP_PATTERN':
      return 'invalid_ip';
    case 'GROUP_NOT_ALLOWED':
      return 'group_not_allowed';
    case 'API_KEY_NOT_FOUND':
      return 'not_found';
  }
  if (error.status === 404) return 'not_found';
  if (error.status === 403) return 'forbidden';
  if (error.status === 429) return 'too_many';
  if (error.status >= 500) return 'unavailable';
  return 'invalid';
}

/** 失败原因对应回给浏览器的状态码 */
export function keyErrorStatus(reason: KeyErrorReason): number {
  switch (reason) {
    case 'key_exists':
      return 409;
    case 'group_not_allowed':
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'too_many':
      return 429;
    case 'unavailable':
      return 503;
    default:
      return 400;
  }
}
