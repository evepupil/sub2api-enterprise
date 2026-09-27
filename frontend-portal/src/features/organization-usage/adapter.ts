/**
 * M4 组织用量数据适配（纯函数，无网络、无副作用）。
 *
 * 契约来源：src/features/organization-usage/types.ts、docs/模块设计/组织用量.md。
 * 复用个人统计已经过真实后端验证的 parseUsageRecords 保留安全明细，
 * 再按白名单补充组织维度字段；成员行只读接口明列的字段。
 *
 * 边界：
 * - 只输出白名单字段：绝不透传 api_key.key、用户余额等原始对象内容。
 * - 任何结构性或数值性错误一律抛 Error，由 UI 显示；
 *   缺失的金额 / 用量不得猜 0，Go 的 nil 数组合法位置按空数组处理。
 * - 只把成员行的出现当作明细来源，不据此推断组织成员总数。
 */
import type { PageResult } from '../keys/types';
import { parseUsageRecords } from '../usage/adapter';
import type { MemberUsageRow, OrganizationUsageRecord } from './types';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string): Error {
  return new Error(`组织用量数据字段不合法：${path}`);
}

function requiredRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) {
    throw invalid(path);
  }
  return value;
}

/** 合法空数组允许；null / undefined 兼容 Go nil，按空数组处理。 */
function requiredArray(value: unknown, path: string): readonly unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw invalid(path);
  }
  return value;
}

function requiredNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid(path);
  }
  return value;
}

/** 用户标识：必须是正的安全整数，否则拒绝，不用字符串数字凑合。 */
function requiredUserId(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw invalid(path);
  }
  return value;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw invalid(path);
  }
  return value;
}

/** 身份展示字段允许缺失（停用成员可能没有邮箱/昵称），缺失按空串，类型错误仍报错。 */
function optionalString(value: unknown, path: string): string {
  if (value === undefined || value === null) {
    return '';
  }
  return requiredString(value, path);
}

/**
 * 适配 /usage/organization/members 的 data：
 * { start_date, end_date, members: [{ user_id, email, username, display_name,
 *   requests, total_tokens, cost, actual_cost }] }。
 * 只返回 members 数组，owner 本人与停用成员的历史一并保留；
 * 空 / nil 数组返回 []，但 requests、total_tokens、cost、actual_cost 缺失即报错。
 */
export function parseMemberUsage(value: unknown): MemberUsageRow[] {
  const record = requiredRecord(value, 'organization_members');
  return requiredArray(record.members, 'organization_members.members').map((entry, index) => {
    const path = `organization_members.members[${index}]`;
    const member = requiredRecord(entry, path);
    return {
      userId: requiredUserId(member.user_id, `${path}.user_id`),
      email: optionalString(member.email, `${path}.email`),
      username: optionalString(member.username, `${path}.username`),
      displayName: optionalString(member.display_name, `${path}.display_name`),
      requests: requiredNumber(member.requests, `${path}.requests`),
      tokens: requiredNumber(member.total_tokens, `${path}.total_tokens`),
      standardCost: requiredNumber(member.cost, `${path}.cost`),
      actualCost: requiredNumber(member.actual_cost, `${path}.actual_cost`),
    };
  });
}

interface RecordUserLabel {
  email: string;
  username: string;
  displayName: string;
}

/** 只读 user 的 id / email / username / display_name；余额、密钥等一律不进入返回。 */
function parseRecordUser(value: unknown, path: string): RecordUserLabel {
  const user = requiredRecord(value, path);
  if (user.id !== undefined && user.id !== null) {
    requiredUserId(user.id, `${path}.id`);
  }
  return {
    email: optionalString(user.email, `${path}.email`),
    username: optionalString(user.username, `${path}.username`),
    displayName: optionalString(user.display_name, `${path}.display_name`),
  };
}

function labelOf(user: RecordUserLabel, fallback: string): string {
  for (const candidate of [user.displayName, user.username, user.email]) {
    const trimmed = candidate.trim();
    if (trimmed !== '') {
      return trimmed;
    }
  }
  return fallback;
}

/**
 * 适配 /usage?scope=organization 的分页响应：
 * 先用 parseUsageRecords 得到安全的 UsageRecord（不含 api_key.key、余额），
 * 再逐条读取 user_id 与 user{id,email,username,display_name} 白名单，
 * 补上 userId 与 userLabel（display_name → username → email → 成员#id）。
 */
export function parseOrganizationRecords(value: unknown): PageResult<OrganizationUsageRecord> {
  const base = parseUsageRecords(value);
  const raw = requiredRecord(value, 'usage');
  const rawItems = requiredArray(raw.items, 'usage.items');
  if (rawItems.length !== base.items.length) {
    throw invalid('usage.items');
  }

  const items = base.items.map((item, index) => {
    const path = `usage.items[${index}]`;
    const entry = requiredRecord(rawItems[index], path);
    const userId = requiredUserId(entry.user_id, `${path}.user_id`);
    const user =
      entry.user === undefined || entry.user === null
        ? { email: '', username: '', displayName: '' }
        : parseRecordUser(entry.user, `${path}.user`);
    return {
      ...item,
      userId,
      userLabel: labelOf(user, `成员#${userId}`),
    };
  });

  return {
    items,
    total: base.total,
    page: base.page,
    pageSize: base.pageSize,
    pages: base.pages,
  };
}
