/**
 * 配额申请响应的纯适配（无网络、无副作用、与渲染无关）。
 *
 * 契约来源：src/features/organization/types.ts（主控冻结）与
 * ../.fleet/briefs/m45-quota-requests-api.md。
 *
 * 边界：
 * - 输入是已经去掉 API 包装（code/message）的 data，输出只含冻结类型字段，
 *   上游的 snapshot_limit / snapshot_used / reviewer_user_id 等私有字段一律不透传。
 * - 必须字段缺失或类型错误一律抛 Error；未知 status 归为 'unknown'，绝不套成 pending。
 * - memberQuota 的每个字段都必须真实存在：缺失不等于 false，也不等于「不限」；
 *   只有显式 null 的 remaining 才表示不限额，只有显式 null 的 window_end 才表示无重置。
 * - grant_source 只认 manual / auto，其它取值归 null，不猜发放来源。
 */

import type {
  MemberQuotaInfo,
  QuotaRequestMode,
  QuotaRequestPolicy,
  QuotaRequestRecord,
  QuotaRequestStatus,
} from './types';
import type { PageResult } from '../keys/types';

type UnknownRecord = Record<string, unknown>;

const QUOTA_REQUEST_MODES: ReadonlySet<string> = new Set<string>(['off', 'approve', 'auto']);

const QUOTA_REQUEST_STATUSES: ReadonlySet<string> = new Set<string>([
  'pending',
  'granted',
  'rejected',
  'withdrawn',
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string): Error {
  return new Error(`组织配额申请数据字段不合法: ${path}`);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/** 必须字符串：只校验类型，空串是合法业务值（例如未填写理由）。 */
function requiredString(record: UnknownRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw invalid(key);
  }
  return value;
}

/** 标识：必须是正的安全整数。 */
function requiredId(record: UnknownRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw invalid(key);
  }
  return value;
}

/** 金额：必须是有限数字；符号与业务范围由后端保证，前端不猜 0。 */
function requiredNumber(record: UnknownRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalid(key);
  }
  return value;
}

/** 可空数字：缺失或 null 归一成 null；出现但非法则抛错。 */
function optionalNumber(record: UnknownRecord, key: string): number | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalid(key);
  }
  return value;
}

/** 必须布尔：缺失、null、字符串都不接受，绝不猜成 false。 */
function requiredBoolean(record: UnknownRecord, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw invalid(key);
  }
  return value;
}

/** 时间：允许 null/缺失；其余必须是非空且可解析的 ISO 文本，保持原样返回。 */
function optionalTime(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string' || value.trim() === '' || !Number.isFinite(Date.parse(value))) {
    throw invalid(key);
  }
  return value;
}

/** 可空时间字段：DTO 必须带有字段，只有显式 null 才表示无时间。 */
function requiredNullableTime(record: UnknownRecord, key: string): string | null {
  if (!hasOwn(record, key) || record[key] === undefined) {
    throw invalid(key);
  }
  return optionalTime(record, key);
}

/** 可空金额字段：DTO 必须带有字段，只有显式 null 才表示没有范围。 */
function requiredNullableNumber(record: UnknownRecord, key: string): number | null {
  if (!hasOwn(record, key) || record[key] === undefined) {
    throw invalid(key);
  }
  return optionalNumber(record, key);
}

function requiredTime(record: UnknownRecord, key: string): string {
  const value = optionalTime(record, key);
  if (value === null) {
    throw invalid(key);
  }
  return value;
}

function normalizeMode(value: unknown): QuotaRequestMode {
  if (typeof value !== 'string') {
    throw invalid('mode');
  }
  const normalized = value.trim().toLowerCase();
  if (!QUOTA_REQUEST_MODES.has(normalized)) {
    throw invalid('mode');
  }
  return normalized as QuotaRequestMode;
}

/** 未知 status 一律 unknown，绝不回落到 pending。 */
function normalizeStatus(value: unknown): QuotaRequestStatus {
  if (typeof value !== 'string') {
    return 'unknown';
  }
  const normalized = value.trim().toLowerCase();
  return QUOTA_REQUEST_STATUSES.has(normalized) ? (normalized as QuotaRequestStatus) : 'unknown';
}

/** 发放来源：只认 manual / auto，其它取值（含未知字符串）归 null。 */
function normalizeGrantSource(value: unknown): 'manual' | 'auto' | null {
  if (value === 'manual' || value === 'auto') {
    return value;
  }
  return null;
}

/** 读取申请策略：off 时金额一律归一成 null；打开时必须给出正数区间。 */
export function parseRequestPolicy(value: unknown): QuotaRequestPolicy {
  if (!isRecord(value)) {
    throw invalid('policy');
  }
  const mode = normalizeMode(value.mode);
  if (mode === 'off') {
    return { mode, minAmount: null, maxAmount: null };
  }
  const minAmount = optionalNumber(value, 'min_amount');
  const maxAmount = optionalNumber(value, 'max_amount');
  if (minAmount === null || minAmount <= 0) {
    throw invalid('min_amount');
  }
  if (maxAmount === null || maxAmount <= 0 || maxAmount < minAmount) {
    throw invalid('max_amount');
  }
  return { mode, minAmount, maxAmount };
}

/** 单条配额申请：只保留冻结 DTO 字段。 */
export function parseQuotaRequest(value: unknown): QuotaRequestRecord {
  if (!isRecord(value)) {
    throw invalid('request');
  }
  return {
    id: requiredId(value, 'id'),
    userId: requiredId(value, 'user_id'),
    email: requiredString(value, 'email'),
    username: requiredString(value, 'username'),
    displayName: requiredString(value, 'display_name'),
    amount: requiredNumber(value, 'amount'),
    reason: requiredString(value, 'reason'),
    status: normalizeStatus(value.status),
    grantSource: normalizeGrantSource(value.grant_source),
    grantedAmount: optionalNumber(value, 'granted_amount'),
    snapshotMode: requiredString(value, 'snapshot_mode'),
    reviewNote: requiredString(value, 'review_note'),
    reviewedAt: optionalTime(value, 'reviewed_at'),
    createdAt: requiredTime(value, 'created_at'),
  };
}

/** 申请分页：与密钥/用量分页同一套通用结构。 */
export function parseQuotaRequestPage(value: unknown): PageResult<QuotaRequestRecord> {
  if (!isRecord(value)) {
    throw invalid('page');
  }
  const items = value.items;
  if (!Array.isArray(items)) {
    throw invalid('items');
  }
  const total = requiredCount(value, 'total');
  const page = requiredCount(value, 'page');
  const pageSize = requiredCount(value, 'page_size');
  if (pageSize <= 0) {
    throw invalid('page_size');
  }
  const pagesValue = value.pages;
  const pages =
    pagesValue === undefined || pagesValue === null
      ? Math.ceil(total / pageSize)
      : requiredCount(value, 'pages');

  return {
    items: items.map(parseQuotaRequest),
    total,
    page,
    pageSize,
    pages,
  };
}

function requiredCount(record: UnknownRecord, key: string): number {
  const value = record[key];
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isInteger(value)
  ) {
    throw invalid(key);
  }
  return value;
}

/**
 * 成员配额概况：读取 /usage/dashboard/stats 的 organization_quota 块。
 *
 * 兼容传入整包 stats 或直接传入配额块两种形态；无论哪种，字段都必须存在。
 * remaining 显式 null = 不限额；window_end 显式 null = 无重置时间；
 * can_request / pending_exists 缺失一律抛错，绝不猜成 false。
 */
export function parseMemberQuota(value: unknown): MemberQuotaInfo {
  if (!isRecord(value)) {
    throw invalid('stats');
  }
  let quota: UnknownRecord;
  if (hasOwn(value, 'organization_quota')) {
    const raw = value.organization_quota;
    if (raw === undefined || raw === null) {
      throw new Error('组织配额暂时无法读取');
    }
    if (!isRecord(raw)) {
      throw invalid('organization_quota');
    }
    quota = raw;
  } else {
    quota = value;
  }

  if (!hasOwn(quota, 'remaining')) {
    throw invalid('organization_quota.remaining');
  }
  const remainingRaw = quota.remaining;
  const remaining = remainingRaw === null ? null : requiredNumber(quota, 'remaining');

  const windowEnd = requiredNullableTime(quota, 'window_end');
  const canRequest = requiredBoolean(quota, 'can_request');
  const requestMode = normalizeMode(quota.request_mode);
  const minAmount = requiredNullableNumber(quota, 'min_amount');
  const maxAmount = requiredNullableNumber(quota, 'max_amount');
  const pendingExists = requiredBoolean(quota, 'pending_exists');

  return {
    remaining,
    windowEnd,
    canRequest,
    requestMode,
    minAmount,
    maxAmount,
    pendingExists,
  };
}
