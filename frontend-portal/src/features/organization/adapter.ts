/**
 * 组织、成员、邀请与默认配额响应的纯适配（无网络、无副作用、与渲染无关）。
 *
 * 契约来源：src/features/organization/types.ts（主控冻结）与后端
 * handler/organization_*.go、dto.OrganizationSummary 的字段名。
 *
 * 边界：
 * - 输入是已经去掉 API 包装（code/message）的 data，输出只含白名单字段；
 *   password、api_key、内部备注等额外字段一律不透传。
 * - 金额字段区分「缺失」与「合法的 null」：owner 的金额允许为 null，
 *   但字段完全缺失或类型错误一律抛错，不猜 0。
 * - 未知成员/邀请状态归 unknown，不伪造成功；时间保持后端原始 ISO 文本。
 */

import type { PageResult } from '../keys/types';
import type {
  DefaultQuota,
  DefaultQuotaResult,
  MemberStatus,
  OrganizationInfo,
  OrganizationInvitation,
  OrganizationMember,
  RecurringQuota,
} from './types';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string): Error {
  return new Error(`组织数据字段不合法: ${path}`);
}

/** 必须字段缺失或类型错误即失败，不做任何猜测。 */
function requiredField(record: UnknownRecord, key: string, path: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, key) || record[key] === undefined) {
    throw invalid(`${path}.${key}`);
  }
  return record[key];
}

function requiredString(record: UnknownRecord, key: string, path: string): string {
  const value = requiredField(record, key, path);
  if (typeof value !== 'string') {
    throw invalid(`${path}.${key}`);
  }
  return value;
}

/** 标识：必须是正的安全整数，不能把任意字符串拼进路径。 */
function requiredId(record: UnknownRecord, key: string, path: string): number {
  const value = requiredField(record, key, path);
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw invalid(`${path}.${key}`);
  }
  return value;
}

function requiredBoolean(record: UnknownRecord, key: string, path: string): boolean {
  const value = requiredField(record, key, path);
  if (typeof value !== 'boolean') {
    throw invalid(`${path}.${key}`);
  }
  return value;
}

function requiredCount(record: UnknownRecord, key: string, path: string): number {
  const value = requiredField(record, key, path);
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw invalid(`${path}.${key}`);
  }
  return value;
}

/** 金额：字段必须存在；允许合法 null（owner 或「不限」），否则必须是非负有限数。 */
function requiredNullableAmount(record: UnknownRecord, key: string, path: string): number | null {
  const value = requiredField(record, key, path);
  if (value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid(`${path}.${key}`);
  }
  return value;
}

/** 非空金额：已用/冻结这类后端固定返回数值的字段，null 也视为非法。 */
function requiredAmount(record: UnknownRecord, key: string, path: string): number {
  const value = requiredNullableAmount(record, key, path);
  if (value === null) {
    throw invalid(`${path}.${key}`);
  }
  return value;
}

/** 时间：允许 null/缺失；其余必须是非空且可解析的 ISO 文本，保持原样返回。 */
function optionalTime(record: UnknownRecord, key: string, path: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string' || value.trim() === '' || !Number.isFinite(Date.parse(value))) {
    throw invalid(`${path}.${key}`);
  }
  return value;
}

function requiredTime(record: UnknownRecord, key: string, path: string): string {
  const value = optionalTime(record, key, path);
  if (value === null) {
    throw invalid(`${path}.${key}`);
  }
  return value;
}

function normalizeMemberStatus(value: unknown): MemberStatus {
  if (value === 'active' || value === 'disabled') {
    return value;
  }
  return 'unknown';
}

function normalizeInvitationStatus(value: unknown): 'unused' | 'used' | 'disabled' | 'unknown' {
  if (value === 'unused' || value === 'used' || value === 'disabled') {
    return value;
  }
  return 'unknown';
}

/** 周期配额：mode 必须是待生效或已生效，金额/天数/锚点缺一不可，窗口允许 null。 */
function parseRecurringQuota(value: unknown, path: string): RecurringQuota {
  if (!isRecord(value)) {
    throw invalid(path);
  }
  const mode = value.mode;
  if (mode !== 'periodic_pending' && mode !== 'periodic_active') {
    throw invalid(`${path}.mode`);
  }
  const amount = requiredNullableAmount(value, 'amount', path);
  const periodDays = requiredNullableAmount(value, 'period_days', path);
  if (amount === null || periodDays === null || !Number.isInteger(periodDays) || periodDays <= 0) {
    throw invalid(`${path}.period_days`);
  }
  return {
    mode,
    amount,
    periodDays,
    startAt: requiredTime(value, 'start_at', path),
    windowStart: optionalTime(value, 'window_start', path),
    windowEnd: optionalTime(value, 'window_end', path),
  };
}

export function parseOrganization(value: unknown): OrganizationInfo | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw invalid('organization');
  }
  return {
    id: requiredId(value, 'id', 'organization'),
    name: requiredString(value, 'name', 'organization'),
    isOwner: requiredBoolean(value, 'is_owner', 'organization'),
    status: requiredString(value, 'status', 'organization'),
    createdAt: optionalTime(value, 'created_at', 'organization'),
  };
}

export function parseMember(value: unknown, index = 0): OrganizationMember {
  const path = `member[${index}]`;
  if (!isRecord(value)) {
    throw invalid(path);
  }
  const quotaRaw = requiredField(value, 'quota', path);
  const isOwner = requiredBoolean(value, 'is_owner', path);
  // owner 的金额字段可能整组为 null，按「缺失与合法 null」区分保留；
  // 普通成员的已用/冻结必须存在且为数值，null 或缺失一律报错。
  const amountField = isOwner ? requiredNullableAmount : requiredAmount;
  return {
    userId: requiredId(value, 'user_id', path),
    email: requiredString(value, 'email', path),
    username: requiredString(value, 'username', path),
    displayName: requiredString(value, 'display_name', path),
    status: normalizeMemberStatus(requiredField(value, 'status', path)),
    isOwner,
    limit: requiredNullableAmount(value, 'spending_limit', path),
    used: amountField(value, 'spending_used', path),
    frozen: amountField(value, 'spending_frozen', path),
    remaining: requiredNullableAmount(value, 'spending_remaining', path),
    quota: quotaRaw === null ? null : parseRecurringQuota(quotaRaw, `${path}.quota`),
    joinedAt: requiredTime(value, 'joined_at', path),
  };
}

export function parseMemberPage(value: unknown): PageResult<OrganizationMember> {
  if (!isRecord(value)) {
    throw invalid('page');
  }
  const items = requiredField(value, 'items', 'page');
  if (!Array.isArray(items)) {
    throw invalid('page.items');
  }
  const total = requiredCount(value, 'total', 'page');
  const page = requiredCount(value, 'page', 'page');
  const pageSize = requiredCount(value, 'page_size', 'page');
  if (pageSize <= 0) {
    throw invalid('page.page_size');
  }
  const pagesValue = value.pages;
  const pages =
    pagesValue === undefined || pagesValue === null
      ? Math.ceil(total / pageSize)
      : requiredCount(value, 'pages', 'page');

  return {
    items: items.map((item, index) => parseMember(item, index)),
    total,
    page,
    pageSize,
    pages,
  };
}

export function parseInvitations(value: unknown): OrganizationInvitation[] {
  if (!Array.isArray(value)) {
    throw invalid('invitations');
  }
  return value.map((entry, index) => {
    const path = `invitation[${index}]`;
    if (!isRecord(entry)) {
      throw invalid(path);
    }
    return {
      id: requiredId(entry, 'id', path),
      code: requiredString(entry, 'code', path),
      status: normalizeInvitationStatus(requiredField(entry, 'status', path)),
      createdAt: requiredTime(entry, 'created_at', path),
      expiresAt: optionalTime(entry, 'expires_at', path),
      usedAt: optionalTime(entry, 'used_at', path),
    };
  });
}

export function parseDefaultQuota(value: unknown): DefaultQuota {
  if (!isRecord(value)) {
    throw invalid('default_quota');
  }
  const enabled = requiredBoolean(value, 'enabled', 'default_quota');
  const amount = requiredNullableAmount(value, 'amount', 'default_quota');
  const periodDays = requiredNullableAmount(value, 'period_days', 'default_quota');
  if (enabled && (amount === null || periodDays === null)) {
    throw invalid('default_quota');
  }
  if (periodDays !== null && (!Number.isInteger(periodDays) || periodDays <= 0)) {
    throw invalid('default_quota.period_days');
  }
  return { enabled, amount, periodDays };
}

/** 保存默认配额的结果：quota 与 synced_users 都必须在，人数缺失不猜 0。 */
export function parseDefaultQuotaResult(value: unknown): DefaultQuotaResult {
  if (!isRecord(value)) {
    throw invalid('default_quota_result');
  }
  return {
    quota: parseDefaultQuota(requiredField(value, 'quota', 'default_quota_result')),
    syncedUsers: requiredCount(value, 'synced_users', 'default_quota_result'),
  };
}
