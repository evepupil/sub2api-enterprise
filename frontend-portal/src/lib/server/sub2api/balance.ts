import {
  isLedgerType,
  type BalanceSummary,
  type LedgerEntry,
  type LedgerPage,
  type LedgerQuery,
  type RedeemError,
  type RedeemResult,
} from '@/lib/console/live/billing-types';
import { PAGE_SIZES } from '@/lib/console/pagination';

import { CONSOLE_TIMEZONE, isDateKey } from './date-range';
import type { BackendError } from './envelope';

/**
 * 控制台账单页的后端接口：查询参数的校验、拼后端地址、把后端结果换成浏览器用的形状。纯函数，单测锁住。
 * 后端接口见技术设计 18.5；日期按北京时间划分，和控制台显示一致。
 */

export const BALANCE_SUMMARY_PATH = '/user/balance/summary';
export const REDEEM_PATH = '/redeem';

/** 搜索词与来源的长度上限（和后端一致，超长的直接当参数不合法） */
const MAX_QUERY_LENGTH = 64;
const SOURCE_PATTERN = /^[a-z0-9_]{1,32}$/;
/** 兑换码长度上限：后端生成的是 32 位，充值订单的码更短，留些余量 */
const MAX_REDEEM_CODE_LENGTH = 64;

const DEFAULT_PAGE_SIZE = PAGE_SIZES[1] ?? 20;

/** 非负金额；不填为 null，填了但不是非负数字时返回 undefined（参数不合法） */
function parseAmount(raw: string | null): number | null | undefined {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function parsePositiveInt(raw: string | null, fallback: number): number | undefined {
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : undefined;
}

/**
 * 浏览器传来的 ?page=&size=&type=&source=&q=&min=&max=&from=&to=。
 * 任何一项不合法（页码、每页条数不在可选值里、类型或来源写错、金额为负或颠倒、日期不合法或颠倒）返回 null。
 */
export function parseLedgerQuery(params: URLSearchParams): LedgerQuery | null {
  const page = parsePositiveInt(params.get('page'), 1);
  const pageSize = parsePositiveInt(params.get('size'), DEFAULT_PAGE_SIZE);
  if (page === undefined || pageSize === undefined || !PAGE_SIZES.includes(pageSize)) return null;

  const rawType = params.get('type') ?? '';
  if (rawType !== '' && !isLedgerType(rawType)) return null;
  const rawSource = params.get('source') ?? '';
  if (rawSource !== '' && !SOURCE_PATTERN.test(rawSource)) return null;
  const query = (params.get('q') ?? '').trim();
  if (query.length > MAX_QUERY_LENGTH) return null;

  const minUsd = parseAmount(params.get('min'));
  const maxUsd = parseAmount(params.get('max'));
  if (minUsd === undefined || maxUsd === undefined) return null;
  if (minUsd !== null && maxUsd !== null && minUsd > maxUsd) return null;

  const from = params.get('from');
  const to = params.get('to');
  if ((from !== null && !isDateKey(from)) || (to !== null && !isDateKey(to))) return null;
  if (from !== null && to !== null && from > to) return null;

  return {
    page,
    pageSize,
    type: rawType === '' ? null : (rawType as LedgerQuery['type']),
    source: rawSource === '' ? null : rawSource,
    query,
    minUsd,
    maxUsd,
    from,
    to,
  };
}

/** 后端地址：只带填了的筛选条件；有日期时固定按北京时间划分 */
export function ledgerPath(query: LedgerQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
  });
  if (query.type) params.set('type', query.type);
  if (query.source) params.set('source', query.source);
  if (query.query !== '') params.set('q', query.query);
  if (query.minUsd !== null) params.set('min_amount', String(query.minUsd));
  if (query.maxUsd !== null) params.set('max_amount', String(query.maxUsd));
  if (query.from !== null) params.set('start_date', query.from);
  if (query.to !== null) params.set('end_date', query.to);
  if (query.from !== null || query.to !== null) params.set('timezone', CONSOLE_TIMEZONE);
  return `/user/balance/ledger?${params.toString()}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** 后端 data → 余额卡；缺了任何一个数字返回 null */
export function toBalanceSummary(raw: unknown): BalanceSummary | null {
  if (!isRecord(raw)) return null;
  const fields = [
    raw.balance,
    raw.total_recharged,
    raw.total_bonus,
    raw.total_consumed,
    raw.recent_consumed,
    raw.recent_days,
  ];
  if (!fields.every(isNumber)) return null;
  return {
    balanceUsd: raw.balance as number,
    rechargedUsd: raw.total_recharged as number,
    bonusUsd: raw.total_bonus as number,
    consumedUsd: raw.total_consumed as number,
    recentConsumedUsd: raw.recent_consumed as number,
    recentDays: raw.recent_days as number,
  };
}

/** 一笔流水；类型不认识、金额或时间不对的整行丢掉，不让页面显示半截数据 */
function toLedgerEntry(raw: Record<string, unknown>): LedgerEntry | null {
  if (typeof raw.id !== 'string' || !isLedgerType(raw.type)) return null;
  if (!isNumber(raw.amount) || !isNumber(raw.balance_after)) return null;
  const ts = typeof raw.created_at === 'string' ? Date.parse(raw.created_at) : Number.NaN;
  if (Number.isNaN(ts)) return null;
  return {
    id: raw.id,
    type: raw.type,
    source: text(raw.source),
    amountUsd: raw.amount,
    balanceAfterUsd: raw.balance_after,
    reference: text(raw.reference),
    note: text(raw.note),
    ts,
  };
}

/** 后端 data → 一页流水；缺了总数或列表时返回 null */
export function toLedgerPage(raw: unknown): LedgerPage | null {
  if (!isRecord(raw) || !Array.isArray(raw.items) || !isNumber(raw.total)) return null;
  const items = raw.items
    .filter(isRecord)
    .map(toLedgerEntry)
    .filter((entry): entry is LedgerEntry => entry !== null);
  const sources = Array.isArray(raw.sources)
    ? raw.sources.filter((source): source is string => typeof source === 'string')
    : [];
  return {
    items,
    total: raw.total,
    page: isNumber(raw.page) ? raw.page : 1,
    pageSize: isNumber(raw.page_size) ? raw.page_size : DEFAULT_PAGE_SIZE,
    pages: isNumber(raw.pages) ? raw.pages : 1,
    sources,
  };
}

/** 浏览器提交的兑换码：去掉首尾空白，不改大小写（后端的码区分大小写）；空的或超长时返回 null */
export function parseRedeemCode(body: Record<string, unknown>): string | null {
  const code = text(body.code).trim();
  return code === '' || code.length > MAX_REDEEM_CODE_LENGTH ? null : code;
}

/** 后端兑换结果 → 码类型与面值 */
export function toRedeemResult(raw: unknown): RedeemResult | null {
  if (!isRecord(raw) || typeof raw.type !== 'string' || !isNumber(raw.value)) return null;
  return { type: raw.type, value: raw.value };
}

const REDEEM_REASONS: Record<string, RedeemError> = {
  REDEEM_CODE_NOT_FOUND: 'not_found',
  REDEEM_CODE_USED: 'used',
  REDEEM_CODE_EXPIRED: 'expired',
  REDEEM_CODE_LOCKED: 'busy',
  REDEEM_RATE_LIMITED: 'too_many',
};

/** 后端兑换错误 → 页面按原因显示的提示；认不出的一律当服务暂时不可用 */
export function redeemErrorFor(error: BackendError): RedeemError {
  const mapped = REDEEM_REASONS[error.reason];
  if (mapped) return mapped;
  return error.status === 429 ? 'too_many' : 'unavailable';
}
