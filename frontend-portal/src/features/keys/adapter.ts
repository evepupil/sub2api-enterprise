/**
 * 密钥接口响应的纯适配（无网络、无副作用、与渲染无关）。
 *
 * 契约来源：src/features/keys/types.ts（主控冻结）与后端 handler/dto 的 APIKey/Group 字段。
 *
 * 边界：
 * - 输入是已经去掉 API 包装（code/message）的 data，输出只含 KeyRecord/AvailableGroup 白名单字段；
 *   user_id、usage_5h/1d/7d、current_concurrency 等内部字段一律不透传。
 * - 必须字段缺失或类型错误、金额非有限非负数、非法时间一律抛 Error，由页面按失败处理。
 * - 时间字段保持后端原始 ISO 文本（只做可解析校验），不做时区换算，避免悄悄改变展示值。
 * - expires_at / last_used_at 允许 null；Go 的 nil 切片会序列化成 null，IP 名单按空数组处理。
 */

import type { AvailableGroup, KeyRecord, PageResult } from './types';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string): Error {
  return new Error(`密钥数据字段不合法: ${path}`);
}

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

/** 金额/配额/限速：必须是有限且不小于 0 的数字，0 保持 0。 */
function requiredAmount(record: UnknownRecord, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
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

/** 必须时间：created_at 不能为 null。 */
function requiredTime(record: UnknownRecord, key: string): string {
  const value = optionalTime(record, key);
  if (value === null) {
    throw invalid(key);
  }
  return value;
}

/** 字符串数组：null/缺失按空数组；元素必须都是字符串。 */
function stringArray(record: UnknownRecord, key: string): string[] {
  const value = record[key];
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw invalid(key);
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw invalid(`${key}[${index}]`);
    }
    return entry;
  });
}

/** 分组名来自可选的 group 对象；group 缺失或为 null 时为空。 */
function groupName(record: UnknownRecord): string | null {
  const value = record.group;
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw invalid('group');
  }
  const name = value.name;
  if (typeof name !== 'string') {
    throw invalid('group.name');
  }
  return name;
}

/** 分组 ID：允许 null；非 null 时必须是正的安全整数。 */
function groupId(record: UnknownRecord): number | null {
  const value = record.group_id;
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw invalid('group_id');
  }
  return value;
}

export function parseKeyRecord(value: unknown): KeyRecord {
  if (!isRecord(value)) {
    throw invalid('key');
  }
  return {
    id: requiredId(value, 'id'),
    name: requiredString(value, 'name'),
    key: requiredString(value, 'key'),
    status: requiredString(value, 'status'),
    groupId: groupId(value),
    groupName: groupName(value),
    quota: requiredAmount(value, 'quota'),
    quotaUsed: requiredAmount(value, 'quota_used'),
    expiresAt: optionalTime(value, 'expires_at'),
    createdAt: requiredTime(value, 'created_at'),
    lastUsedAt: optionalTime(value, 'last_used_at'),
    ipWhitelist: stringArray(value, 'ip_whitelist'),
    ipBlacklist: stringArray(value, 'ip_blacklist'),
    limit5h: requiredAmount(value, 'rate_limit_5h'),
    limit1d: requiredAmount(value, 'rate_limit_1d'),
    limit7d: requiredAmount(value, 'rate_limit_7d'),
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

export function parseKeyPage(value: unknown): PageResult<KeyRecord> {
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

  // 后端通常会给 pages；缺失时按契约用 ceil(total / page_size) 补齐。
  const pagesValue = value.pages;
  let pages: number;
  if (pagesValue === undefined || pagesValue === null) {
    pages = Math.ceil(total / pageSize);
  } else {
    pages = requiredCount(value, 'pages');
  }

  return {
    items: items.map(parseKeyRecord),
    total,
    page,
    pageSize,
    pages,
  };
}

function parseAvailableGroup(value: unknown, index: number): AvailableGroup {
  if (!isRecord(value)) {
    throw invalid(`groups[${index}]`);
  }
  return {
    id: requiredId(value, 'id'),
    name: requiredString(value, 'name'),
    platform: requiredString(value, 'platform'),
    subscriptionType: requiredString(value, 'subscription_type'),
  };
}

export function parseAvailableGroups(value: unknown): AvailableGroup[] {
  if (!Array.isArray(value)) {
    throw invalid('groups');
  }
  return value.map(parseAvailableGroup);
}
