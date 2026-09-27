/**
 * M1 公开状态纯适配（无网络、无副作用、与渲染无关）。
 *
 * 契约来源：src/features/public/types.ts 的 StatusData，以及 DESIGN.md 的公开数据契约。
 * 输入是已经去掉 API 包装的原始对象；输出只包含 StatusData 白名单字段，绝不透传额外字段。
 *
 * 任何结构性或数值性错误一律抛 Error，由请求层统一转成「不可用」，
 * 不在适配层猜测、补点或推算可用率。
 */
import type { AvailabilityPoint, StatusComponent, StatusData, StatusLevel } from '../public/types';

/** 单个组件时间线最多保留的近期记录数。 */
const MAX_TIMELINE_POINTS = 60;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 校验日期部分真实存在。Date.parse 会把 2026-02-30 静默滚到 3 月，
 * 这里做一次日历回环检查，确保不把非法日期当成有效输入。
 */
function assertCalendarDate(year: number, month: number, day: number, label: string): void {
  if (month < 1 || month > 12 || day < 1) {
    throw new Error(`${label} 不是有效日期`);
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) {
    throw new Error(`${label} 不是有效日期`);
  }
}

/** 未知或缺失的状态值一律归为 unknown，绝不猜测成可用或不可用。 */
function normalizeLevel(value: unknown): StatusLevel {
  if (
    value === 'operational' ||
    value === 'degraded' ||
    value === 'outage' ||
    value === 'unknown'
  ) {
    return value;
  }
  return 'unknown';
}

/** 可用率允许 null/缺失；其余必须是 0..100 的有限数，0 保持 0。 */
function parseAvailability(value: unknown, label: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} 必须是 0..100 的有限数或 null`);
  }
  return value;
}

/** 延迟允许 null/缺失；其余必须是 >=0 的有限数，0 保持 0。 */
function parseLatency(value: unknown, label: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} 必须是 >=0 的有限数或 null`);
  }
  return value;
}

/**
 * 解析并归一化时间：只接受 ISO 8601，统一输出 UTC ISO 字符串。
 * 不带时区的时间按 UTC 解释，避免服务器本地时区影响排序结果。
 */
function parseIsoTime(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} 必须是 ISO 8601 字符串`);
  }
  const text = value.trim();

  const calendar = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (calendar === null) {
    throw new Error(`${label} 必须是 ISO 8601 字符串`);
  }
  assertCalendarDate(Number(calendar[1]), Number(calendar[2]), Number(calendar[3]), label);

  if (DATE_ONLY_PATTERN.test(text)) {
    const dateOnly = Date.parse(text);
    if (!Number.isFinite(dateOnly)) {
      throw new Error(`${label} 不是有效日期`);
    }
    return new Date(dateOnly).toISOString();
  }

  const matched = DATE_TIME_PATTERN.exec(text);
  if (matched === null) {
    throw new Error(`${label} 必须是 ISO 8601 字符串`);
  }
  const withSeparator = text.replace(' ', 'T');
  const zoned = matched[1] === undefined ? `${withSeparator}Z` : withSeparator;
  const parsed = Date.parse(zoned);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} 不是有效日期`);
  }
  return new Date(parsed).toISOString();
}

/**
 * 解析组件时间线：保留 unknown，不合并、不补点、不推算。
 * 先按时间正序排序，超过上限时只保留最近 MAX_TIMELINE_POINTS 条。
 */
function parseTimeline(value: unknown, label: string): AvailabilityPoint[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${label} 必须是数组`);
  }

  const points: AvailabilityPoint[] = value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`${label}[${index}] 必须是对象`);
    }
    return {
      level: normalizeLevel(entry.status),
      checkedAt: parseIsoTime(entry.checked_at, `${label}[${index}].checked_at`),
    };
  });

  // 已归一为等长 UTC ISO 字符串，字典序即时间序；不用 localeCompare 以免受本地环境影响。
  points.sort((a, b) => {
    if (a.checkedAt < b.checkedAt) {
      return -1;
    }
    if (a.checkedAt > b.checkedAt) {
      return 1;
    }
    return 0;
  });

  if (points.length > MAX_TIMELINE_POINTS) {
    return points.slice(points.length - MAX_TIMELINE_POINTS);
  }
  return points;
}

function parseComponent(value: unknown, label: string): StatusComponent {
  if (!isRecord(value)) {
    throw new Error(`${label} 必须是对象`);
  }

  const name = value.name;
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error(`${label}.name 必须是非空字符串`);
  }

  const groupNameRaw = value.group_name;
  let groupName: string | null;
  if (groupNameRaw === undefined || groupNameRaw === null) {
    groupName = null;
  } else if (typeof groupNameRaw === 'string') {
    groupName = groupNameRaw;
  } else {
    throw new Error(`${label}.group_name 必须是字符串或 null`);
  }

  const level = normalizeLevel(value.status);
  const history = parseTimeline(value.timeline, `${label}.timeline`);

  // 先严格校验，再决定是否降级为 null：非法值仍然要抛错。
  const availabilityRaw = parseAvailability(value.availability_7d, `${label}.availability_7d`);
  const latencyMs = parseLatency(value.latency_ms, `${label}.latency_ms`);

  // 没有任何已知状态记录且组件自身状态未知时，后端默认的 0 不代表真实停机，降级为 null。
  const hasKnownRecord = history.some((point) => point.level !== 'unknown');
  const availability = level === 'unknown' && !hasKnownRecord ? null : availabilityRaw;

  return { name, groupName, level, availability, latencyMs, history };
}

/**
 * 把去掉 API 包装的状态对象适配成 StatusData。
 *
 * - status / timeline.status 的未知取值转 unknown；
 * - updated_at 与 checked_at 必须是有效 ISO，输出统一归一为 UTC ISO；
 * - availability_7d / latency_ms 允许 null 或缺失，非法非空值抛错，0 保持 0；
 * - components 为空时，顶层 level 为 unknown、availability 为 null。
 */
export function parseStatus(value: unknown): StatusData {
  if (!isRecord(value)) {
    throw new Error('状态数据必须是对象');
  }

  const componentsRaw = value.components;
  if (!Array.isArray(componentsRaw)) {
    throw new Error('状态数据缺少 components 数组');
  }

  const updatedAt = parseIsoTime(value.updated_at, 'updated_at');
  const components = componentsRaw.map((entry, index) =>
    parseComponent(entry, `components[${index}]`),
  );

  const availabilityRaw = parseAvailability(value.availability_7d, 'availability_7d');
  const isEmpty = components.length === 0;
  const hasSamples = components.some(
    (component) =>
      component.level !== 'unknown' || component.history.some((point) => point.level !== 'unknown'),
  );

  return {
    level: isEmpty ? 'unknown' : normalizeLevel(value.status),
    updatedAt,
    availability: hasSamples ? availabilityRaw : null,
    components,
  };
}
