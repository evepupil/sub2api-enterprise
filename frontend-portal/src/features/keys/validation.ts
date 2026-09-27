/**
 * 密钥表单的纯校验与载荷构造（无网络、无副作用、与渲染无关）。
 *
 * 契约来源：src/features/keys/types.ts（主控冻结）与 design/customer-console.md 第 3 节。
 *
 * 边界：
 * - 只做本地可判定的校验（必填、金额有限非负、日期格式与未来性、IP 行清洗）；
 *   字符串型 IP 的最终合法性由后端判定，这里不做残缺的 IPv6 正则。
 * - 任何非法输入一律抛 Error，不静默改写成其它值。
 * - 输出只包含后端 create/update 认识的字段，不透传 UI 内部状态。
 */

import type { KeyDraft, KeyRecord } from './types';

/** 名称与单条 IP 文本的本地长度上限（后端另有截断，这里只防明显异常输入）。 */
const MAX_NAME_LENGTH = 100;
const MAX_IP_LINE_LENGTH = 100;
/** 单个名单最多提交的条目数，避免把超长文本整段发到后端。 */
const MAX_IP_LINES = 200;

const DATE_ONLY_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const POSITIVE_INTEGER_PATTERN = /^[0-9]+$/;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function fail(field: string, reason: string): never {
  throw new Error(`密钥${field}${reason}`);
}

/** 把「空字符串代表不限」的金额文本转成后端数字；空 => 0，非法或负 => 抛错。 */
function parseAmount(value: string, field: string): number {
  const text = value.trim();
  if (text === '') {
    return 0;
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) {
    fail(field, '必须是不小于 0 的数字');
  }
  return parsed;
}

/** 分组 ID 允许为 null；非 null 时必须是正整数。 */
function parseGroupId(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail('分组', '不正确');
  }
  return value;
}

/** 有效期天数：空 => 不提交该字段；填写则必须是正整数。 */
function parseExpiresInDays(value: string): number | null {
  const text = value.trim();
  if (text === '') {
    return null;
  }
  if (!POSITIVE_INTEGER_PATTERN.test(text)) {
    fail('有效期', '必须是正整数天数');
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    fail('有效期', '必须是正整数天数');
  }
  return parsed;
}

/**
 * 把 datetime-local / date 文本按浏览器本地时区解析成 ISO 字符串。
 * 组件必须真实存在（拒绝 2026-02-30 这类会被 Date 静默滚动的日期），且必须是未来时间。
 */
function parseExpiresAt(value: string, now: Date): string {
  const text = value.trim();
  const dateTimeMatch = DATE_TIME_LOCAL_PATTERN.exec(text);
  const dateOnlyMatch = dateTimeMatch === null ? DATE_ONLY_LOCAL_PATTERN.exec(text) : null;
  const match = dateTimeMatch ?? dateOnlyMatch;
  if (match === null) {
    fail('过期时间', '格式不正确');
  }
  // 仅日期按浏览器本地零点解释，与 datetime-local 保持同一时区语义。
  const hasTime = dateTimeMatch !== null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = hasTime ? Number(match[4]) : 0;
  const minute = hasTime ? Number(match[5]) : 0;
  const second = hasTime && match[6] !== undefined ? Number(match[6]) : 0;
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) {
    fail('过期时间', '格式不正确');
  }

  const date = new Date(year, month - 1, day, hour, minute, second, 0);
  const timestamp = date.getTime();
  if (
    !Number.isFinite(timestamp) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    fail('过期时间', '不是有效时间');
  }
  if (timestamp <= now.getTime()) {
    fail('过期时间', '必须晚于当前时间');
  }
  return date.toISOString();
}

/** 换行分隔的 IP 文本：去空白、去空行、按首次出现去重，不做 IP 语法校验。 */
function parseIpLines(value: string, field: string): string[] {
  const lines = value.split(/\r\n|\r|\n/u);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    if (trimmed.length > MAX_IP_LINE_LENGTH) {
      fail(field, `单条不能超过 ${MAX_IP_LINE_LENGTH} 个字符`);
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length > MAX_IP_LINES) {
      fail(field, `最多 ${MAX_IP_LINES} 条`);
    }
  }
  return result;
}

/** 后端返回的 ISO 时间转成浏览器本地的 datetime-local 文本，用于编辑回填。 */
function toLocalDateTimeInput(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    fail('过期时间', '不是有效时间');
  }
  const date = new Date(timestamp);
  const datePart = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const timePart = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (date.getSeconds() === 0 && date.getMilliseconds() === 0) {
    return `${datePart}T${timePart}`;
  }
  return `${datePart}T${timePart}:${pad2(date.getSeconds())}`;
}

/** 金额回填：0 表示不限，回填为空字符串，避免把「不限」显示成 0 后又被当成额度。 */
function amountToInput(value: number): string {
  return value > 0 ? String(value) : '';
}

/**
 * 列表掩码：长度 <= 12 时保留前 4 位，否则保留前 6 位与后 4 位。
 * 完整密钥的复制由 UI 负责，这里不返回任何可还原的片段组合。
 */
export function maskKey(key: string): string {
  if (key.length === 0) {
    return '';
  }
  if (key.length <= 12) {
    return `${key.slice(0, 4)}***`;
  }
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function createEmptyKeyDraft(): KeyDraft {
  return {
    name: '',
    groupId: null,
    quota: '',
    expiresInDays: '',
    expiresAt: '',
    ipWhitelist: '',
    ipBlacklist: '',
    limit5h: '',
    limit1d: '',
    limit7d: '',
  };
}

/**
 * 记录转编辑草稿：只取表单字段，额外内部字段（user_id、usage_*、并发等）不进入 UI。
 * 已有时长字段为空表示「不限」，与后端 0 的语义一致。
 */
export function keyToDraft(record: KeyRecord): KeyDraft {
  return {
    name: record.name,
    groupId: record.groupId,
    quota: amountToInput(record.quota),
    expiresInDays: '',
    expiresAt: record.expiresAt === null ? '' : toLocalDateTimeInput(record.expiresAt),
    ipWhitelist: record.ipWhitelist.join('\n'),
    ipBlacklist: record.ipBlacklist.join('\n'),
    limit5h: amountToInput(record.limit5h),
    limit1d: amountToInput(record.limit1d),
    limit7d: amountToInput(record.limit7d),
  };
}

/**
 * 构造 create/update 请求体。
 *
 * create：不提交 expires_at，有效期走 expires_in_days（空则不提交）。
 * edit：不提交 expires_in_days，过期时间走 expires_at（空字符串表示清除）。
 * 两种模式都提交 name / group_id / quota / 限速 / IP 名单，其余字段一律不出现。
 */
export function buildKeyPayload(
  draft: KeyDraft,
  mode: 'create' | 'edit',
  now: Date = new Date(),
): Record<string, unknown> {
  const name = draft.name.trim();
  if (name.length === 0) {
    fail('名称', '不能为空');
  }
  if (name.length > MAX_NAME_LENGTH) {
    fail('名称', `不能超过 ${MAX_NAME_LENGTH} 个字符`);
  }

  const payload: Record<string, unknown> = {
    name,
    group_id: parseGroupId(draft.groupId),
    quota: parseAmount(draft.quota, '额度'),
    ip_whitelist: parseIpLines(draft.ipWhitelist, 'IP 白名单'),
    ip_blacklist: parseIpLines(draft.ipBlacklist, 'IP 黑名单'),
    rate_limit_5h: parseAmount(draft.limit5h, '5 小时限速'),
    rate_limit_1d: parseAmount(draft.limit1d, '1 天限速'),
    rate_limit_7d: parseAmount(draft.limit7d, '7 天限速'),
  };

  if (mode === 'create') {
    const expiresInDays = parseExpiresInDays(draft.expiresInDays);
    if (expiresInDays !== null) {
      payload.expires_in_days = expiresInDays;
    }
    return payload;
  }

  payload.expires_at = draft.expiresAt.trim() === '' ? '' : parseExpiresAt(draft.expiresAt, now);
  return payload;
}
