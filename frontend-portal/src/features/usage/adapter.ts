/**
 * M3 用量数据适配（纯函数，无网络、无副作用）。
 *
 * 契约来源：src/features/usage/types.ts 与 docs/模块设计/用量统计.md。
 * 输入是已经去掉 API 包装的原始对象；输出只包含白名单字段，绝不透传额外字段
 * （stats 的 account_cost / upstream_endpoints 一律不读）。
 *
 * 任何结构性或数值性错误一律抛 Error，由 UI 显示；
 * 不在适配层猜测、补零或推算缺失值。Go 的 nil 数组在合法位置按空数组处理。
 */
import type { PageResult } from '../keys/types';
import type {
  BreakdownRow,
  CurrentFunds,
  UsageOverview,
  UsageRecord,
  UsageSummary,
  UsageTrendPoint,
} from './types';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string): Error {
  return new Error(`用量数据字段不合法：${path}`);
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

function optionalNullableNumber(value: unknown, path: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  return requiredNumber(value, path);
}

/** 允许负值的有限数：后端余额可为欠费透支。 */
function requiredSignedNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
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

function requiredBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw invalid(path);
  }
  return value;
}

function parseSummary(record: UnknownRecord): UsageSummary {
  return {
    requests: requiredNumber(record.total_requests, 'stats.total_requests'),
    tokens: {
      input: requiredNumber(record.total_input_tokens, 'stats.total_input_tokens'),
      output: requiredNumber(record.total_output_tokens, 'stats.total_output_tokens'),
      cacheWrite: requiredNumber(
        record.total_cache_creation_tokens,
        'stats.total_cache_creation_tokens',
      ),
      cacheRead: requiredNumber(record.total_cache_read_tokens, 'stats.total_cache_read_tokens'),
      total: requiredNumber(record.total_tokens, 'stats.total_tokens'),
    },
    actualCost: requiredNumber(record.total_actual_cost, 'stats.total_actual_cost'),
    standardCost: requiredNumber(record.total_cost, 'stats.total_cost'),
    averageDurationMs: requiredNumber(record.average_duration_ms, 'stats.average_duration_ms'),
  };
}

/** 接口分布来自 /usage/stats，只读 endpoint / requests / total_tokens / actual_cost。 */
function parseEndpointRows(value: unknown): BreakdownRow[] {
  return requiredArray(value, 'stats.endpoints').map((entry, index) => {
    const path = `stats.endpoints[${index}]`;
    const record = requiredRecord(entry, path);
    const endpoint = requiredString(record.endpoint, `${path}.endpoint`);
    return {
      id: endpoint,
      label: endpoint,
      requests: requiredNumber(record.requests, `${path}.requests`),
      tokens: requiredNumber(record.total_tokens, `${path}.total_tokens`),
      cost: requiredNumber(record.actual_cost, `${path}.actual_cost`),
    };
  });
}

function parseModelRows(value: unknown): BreakdownRow[] {
  return requiredArray(value, 'snapshot.models').map((entry, index) => {
    const path = `snapshot.models[${index}]`;
    const record = requiredRecord(entry, path);
    const model = requiredString(record.model, `${path}.model`);
    return {
      id: model,
      label: model,
      requests: requiredNumber(record.requests, `${path}.requests`),
      tokens: requiredNumber(record.total_tokens, `${path}.total_tokens`),
      cost: requiredNumber(record.actual_cost, `${path}.actual_cost`),
    };
  });
}

function parseGroupRows(value: unknown): BreakdownRow[] {
  return requiredArray(value, 'snapshot.groups').map((entry, index) => {
    const path = `snapshot.groups[${index}]`;
    const record = requiredRecord(entry, path);
    const groupId = requiredNumber(record.group_id, `${path}.group_id`);
    return {
      id: String(groupId),
      label: requiredString(record.group_name, `${path}.group_name`),
      requests: requiredNumber(record.requests, `${path}.requests`),
      tokens: requiredNumber(record.total_tokens, `${path}.total_tokens`),
      cost: requiredNumber(record.actual_cost, `${path}.actual_cost`),
    };
  });
}

function parseTrend(value: unknown): UsageTrendPoint[] {
  return requiredArray(value, 'snapshot.trend').map((entry, index) => {
    const path = `snapshot.trend[${index}]`;
    const record = requiredRecord(entry, path);
    return {
      date: requiredString(record.date, `${path}.date`),
      requests: requiredNumber(record.requests, `${path}.requests`),
      tokens: {
        input: requiredNumber(record.input_tokens, `${path}.input_tokens`),
        output: requiredNumber(record.output_tokens, `${path}.output_tokens`),
        cacheWrite: requiredNumber(record.cache_creation_tokens, `${path}.cache_creation_tokens`),
        cacheRead: requiredNumber(record.cache_read_tokens, `${path}.cache_read_tokens`),
        total: requiredNumber(record.total_tokens, `${path}.total_tokens`),
      },
      actualCost: requiredNumber(record.actual_cost, `${path}.actual_cost`),
    };
  });
}

/**
 * 合并同一日期范围、同一粒度下 /usage/stats 与 /usage/dashboard/snapshot-v2 的响应。
 * 汇总与接口分布取自 stats，模型/分组/趋势取自 snapshot；两个响应必须成对传入，
 * 不与其它日期范围的响应混用。
 */
export function parseUsageOverview(stats: unknown, snapshot: unknown): UsageOverview {
  const statsRecord = requiredRecord(stats, 'stats');
  const snapshotRecord = requiredRecord(snapshot, 'snapshot');
  return {
    summary: parseSummary(statsRecord),
    models: parseModelRows(snapshotRecord.models),
    groups: parseGroupRows(snapshotRecord.groups),
    endpoints: parseEndpointRows(statsRecord.endpoints),
    trend: parseTrend(snapshotRecord.trend),
  };
}

/** 只读 api_key.name；api_key.key 等其它字段绝不进入返回。 */
function parseKeyName(value: unknown, path: string): string {
  if (value === undefined || value === null) {
    return '';
  }
  const record = requiredRecord(value, path);
  const name = record.name;
  if (name === undefined || name === null) {
    return '';
  }
  return requiredString(name, `${path}.name`);
}

function parseUsageRecord(value: unknown, path: string): UsageRecord {
  const record = requiredRecord(value, path);
  const input = requiredNumber(record.input_tokens, `${path}.input_tokens`);
  const output = requiredNumber(record.output_tokens, `${path}.output_tokens`);
  const cacheWrite = requiredNumber(record.cache_creation_tokens, `${path}.cache_creation_tokens`);
  const cacheRead = requiredNumber(record.cache_read_tokens, `${path}.cache_read_tokens`);
  const totalRaw = record.total_tokens;
  // 明细接口没有 total_tokens 时按四类之和；缓存写入保持独立，不并入读取。
  const total =
    totalRaw === undefined || totalRaw === null
      ? input + output + cacheWrite + cacheRead
      : requiredNumber(totalRaw, `${path}.total_tokens`);

  return {
    id: requiredNumber(record.id, `${path}.id`),
    createdAt: requiredString(record.created_at, `${path}.created_at`),
    model: requiredString(record.model, `${path}.model`),
    keyName: parseKeyName(record.api_key, `${path}.api_key`),
    keyId: requiredNumber(record.api_key_id, `${path}.api_key_id`),
    tokens: { input, output, cacheWrite, cacheRead, total },
    actualCost: requiredNumber(record.actual_cost, `${path}.actual_cost`),
    standardCost: requiredNumber(record.total_cost, `${path}.total_cost`),
    durationMs: optionalNullableNumber(record.duration_ms, `${path}.duration_ms`),
    stream: requiredBoolean(record.stream, `${path}.stream`),
  };
}

/** 把分页响应适配成 PageResult<UsageRecord>，字段严格校验，错误数据抛异常。 */
export function parseUsageRecords(value: unknown): PageResult<UsageRecord> {
  const record = requiredRecord(value, 'usage');
  return {
    items: requiredArray(record.items, 'usage.items').map((entry, index) =>
      parseUsageRecord(entry, `usage.items[${index}]`),
    ),
    total: requiredNumber(record.total, 'usage.total'),
    page: requiredNumber(record.page, 'usage.page'),
    pageSize: requiredNumber(record.page_size, 'usage.page_size'),
    pages: requiredNumber(record.pages, 'usage.pages'),
  };
}

/** /user/profile 的当前余额；非普通成员走这里。
 * balance 可为负（欠费透支），只要求有限；frozen_balance 仍须非负有限。 */
export function parseBalanceFunds(value: unknown): CurrentFunds {
  const record = requiredRecord(value, 'profile');
  return {
    kind: 'balance',
    amount: requiredSignedNumber(record.balance, 'profile.balance'),
    frozen: requiredNumber(record.frozen_balance, 'profile.frozen_balance'),
  };
}

/**
 * 普通组织成员只看 /usage/dashboard/stats 的 organization_quota。
 * 缺失或非法一律抛安全错误，绝不猜测余额或把配额当 0。
 * 只有显式 null 才表示后端明示的「不限额」；字段缺失同样是错误。
 */
export function parseQuotaFunds(value: unknown): CurrentFunds {
  const record = requiredRecord(value, 'stats');
  const quotaRaw = record.organization_quota;
  if (quotaRaw === undefined || quotaRaw === null) {
    throw new Error('组织配额暂时无法读取');
  }
  const quota = requiredRecord(quotaRaw, 'stats.organization_quota');

  if (!Object.prototype.hasOwnProperty.call(quota, 'remaining')) {
    throw invalid('stats.organization_quota.remaining');
  }
  const remainingRaw = quota.remaining;
  const amount =
    remainingRaw === null
      ? null
      : requiredNumber(remainingRaw, 'stats.organization_quota.remaining');

  const windowRaw = quota.window_end;
  let windowEnd: string | null;
  if (windowRaw === undefined || windowRaw === null) {
    windowEnd = null;
  } else if (
    typeof windowRaw === 'string' &&
    windowRaw.trim() !== '' &&
    Number.isFinite(Date.parse(windowRaw))
  ) {
    windowEnd = windowRaw;
  } else {
    throw invalid('stats.organization_quota.window_end');
  }

  return { kind: 'quota', amount, windowEnd };
}
