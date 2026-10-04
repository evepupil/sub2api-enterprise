import type {
  LogFilters,
  LogOptions,
  LogQuery,
  LogRow,
  LogsPageData,
  LogStream,
  LogType,
} from '@/lib/console/live/logs-types';
import { fastModeOf, type FastMode } from '@/lib/console/live/logs-view';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '@/lib/console/pagination';
import { formatDateTime } from '@/lib/console/time';

import { CONSOLE_TIMEZONE, parseDateRange } from './date-range';

/**
 * 控制台日志页的后端接口：查询参数的校验、拼后端地址、把后端使用记录换成浏览器用的形状、生成 CSV。
 * 纯函数，单测锁住。后端记录里带着完整的密钥，这里只挑密钥的 ID 和名字，不往外传。
 */

type RawRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const count = (value: unknown): number => num(value) ?? 0;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const list = (value: unknown): RawRecord[] => (Array.isArray(value) ? value.filter(isRecord) : []);

const LOG_TYPES: readonly LogType[] = ['all', 'text', 'image'];
const LOG_STREAMS: readonly LogStream[] = ['all', 'stream', 'nonStream'];
const MODEL_MAX_LENGTH = 200;

/** 筛选条件：?from&to&key&model&type&stream；不合法时返回 null */
export function parseLogFilters(params: URLSearchParams): LogFilters | null {
  const range = parseDateRange(params);
  if (!range) return null;

  const keyParam = params.get('key');
  const keyId = keyParam ? Number(keyParam) : null;
  if (keyId !== null && (!Number.isSafeInteger(keyId) || keyId <= 0)) return null;

  const model = params.get('model')?.trim() || null;
  if (model !== null && model.length > MODEL_MAX_LENGTH) return null;

  const type = LOG_TYPES.find((value) => value === (params.get('type') ?? 'all'));
  const stream = LOG_STREAMS.find((value) => value === (params.get('stream') ?? 'all'));
  if (!type || !stream) return null;

  return { ...range, keyId, model, type, stream };
}

/** 筛选条件加分页：?page&pageSize（每页条数只认分页组件给的几档） */
export function parseLogQuery(params: URLSearchParams): LogQuery | null {
  const filters = parseLogFilters(params);
  if (!filters) return null;
  const page = Number(params.get('page') ?? '1');
  const pageSize = Number(params.get('pageSize') ?? String(DEFAULT_PAGE_SIZE));
  if (!Number.isSafeInteger(page) || page < 1) return null;
  if (!PAGE_SIZES.includes(pageSize)) return null;
  return { ...filters, page, pageSize };
}

/** 后端使用记录列表的地址：按时间从新到旧；类型对应后端的计费方式，文本是按 Token 计费 */
export function usageLogsPath(filters: LogFilters, page: number, pageSize: number): string {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    start_date: filters.from,
    end_date: filters.to,
    timezone: CONSOLE_TIMEZONE,
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  if (filters.keyId !== null) params.set('api_key_id', String(filters.keyId));
  if (filters.model !== null) params.set('model', filters.model);
  if (filters.type !== 'all')
    params.set('billing_mode', filters.type === 'text' ? 'token' : 'image');
  if (filters.stream !== 'all')
    params.set('stream', filters.stream === 'stream' ? 'true' : 'false');
  return `/usage?${params.toString()}`;
}

/** 各计费尺寸的张数（{ "1K": 2 }）：只留正整数 */
function sizeBreakdown(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isInteger(entry[1]) && entry[1] > 0,
    ),
  );
}

/** 后端一条使用记录 → 日志行；缺了 ID 或时间这种关键字段时返回 null */
export function toLogRow(raw: unknown): LogRow | null {
  if (!isRecord(raw)) return null;
  const id = num(raw.id);
  const createdAt = text(raw.created_at);
  if (id === null || createdAt === null) return null;

  const keyId = count(raw.api_key_id);
  const key = isRecord(raw.api_key) ? raw.api_key : {};
  const groupId = num(raw.group_id);
  const group = isRecord(raw.group) ? raw.group : null;

  return {
    id,
    requestId: text(raw.request_id) ?? '',
    createdAt,
    key: { id: keyId, name: text(key.name) ?? `#${keyId}` },
    group:
      groupId === null ? null : { id: groupId, name: (group && text(group.name)) ?? `#${groupId}` },
    rate: num(raw.rate_multiplier) ?? 1,
    model: text(raw.model) ?? '',
    reasoningEffort: text(raw.reasoning_effort),
    serviceTier: text(raw.service_tier),
    endpoint: text(raw.inbound_endpoint),
    stream: raw.stream === true,
    billingMode: text(raw.billing_mode),
    tokens: {
      input: count(raw.input_tokens),
      output: count(raw.output_tokens),
      cacheRead: count(raw.cache_read_tokens),
      cacheWrite: count(raw.cache_creation_tokens),
    },
    costs: {
      input: count(raw.input_cost),
      output: count(raw.output_cost),
      cacheRead: count(raw.cache_read_cost),
      cacheWrite: count(raw.cache_creation_cost),
      total: count(raw.total_cost),
    },
    actualCost: count(raw.actual_cost),
    longContext: raw.long_context_billing_applied === true,
    durationMs: num(raw.duration_ms),
    firstTokenMs: num(raw.first_token_ms),
    images: {
      count: count(raw.image_count),
      size: text(raw.image_size),
      inputSize: text(raw.image_input_size),
      outputSize: text(raw.image_output_size),
      sizeSource: text(raw.image_size_source),
      breakdown: sizeBreakdown(raw.image_size_breakdown),
      inputTokens: count(raw.image_input_tokens),
      inputCost: count(raw.image_input_cost),
      outputTokens: count(raw.image_output_tokens),
      outputCost: count(raw.image_output_cost),
    },
    userAgent: text(raw.user_agent),
    ip: text(raw.ip_address),
  };
}

/** 后端分页结果 → 一页日志；看不懂时返回 null */
export function toLogsPage(raw: unknown): LogsPageData | null {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;
  return {
    items: raw.items.map(toLogRow).filter((row): row is LogRow => row !== null),
    total: count(raw.total),
    page: num(raw.page) ?? 1,
    pageSize: num(raw.page_size) ?? 20,
  };
}

/** 密钥列表（/keys）+ 这段时间用过的模型（/usage/dashboard/models）→ 筛选下拉的选项 */
export function toLogOptions(keysRaw: unknown, modelsRaw: unknown): LogOptions {
  const keys = list(isRecord(keysRaw) ? keysRaw.items : null)
    .map((key) => {
      const id = num(key.id);
      return id === null ? null : { id, name: text(key.name) ?? `#${id}` };
    })
    .filter((key): key is LogOptions['keys'][number] => key !== null);
  const models = list(isRecord(modelsRaw) ? modelsRaw.models : null)
    .map((item) => text(item.model))
    .filter((model): model is string => model !== null);
  return { keys, models: [...new Set(models)].sort((a, b) => a.localeCompare(b)) };
}

/** CSV 表头与几个取值的写法，按界面语言给 */
export interface LogsCsvLabels {
  headers: readonly string[];
  yes: string;
  no: string;
  noGroup: string;
  /** 「Fast 模式」一列的写法；普通调用留空 */
  fast: Record<FastMode, string>;
}

/** 单元格转义：有逗号、引号、换行的加引号；以 = + - @ 开头的前面加单引号，防止表格软件当公式执行 */
function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let cell = String(value);
  if (/^[=+\-@]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

function fastLabel(serviceTier: string | null, labels: LogsCsvLabels): string | null {
  const mode = fastModeOf(serviceTier);
  return mode === null ? null : labels.fast[mode];
}

/** 日志行 → CSV 文本（北京时间；金额是美元，保留 6 位小数） */
export function logsCsv(rows: readonly LogRow[], labels: LogsCsvLabels): string {
  const lines = rows.map((row) =>
    [
      formatDateTime(Date.parse(row.createdAt)),
      row.requestId,
      row.key.name,
      row.group?.name ?? labels.noGroup,
      row.rate,
      row.model,
      row.reasoningEffort,
      fastLabel(row.serviceTier, labels),
      row.stream ? labels.yes : labels.no,
      row.tokens.input,
      row.tokens.output,
      row.tokens.cacheRead,
      row.tokens.cacheWrite,
      row.actualCost.toFixed(6),
      row.costs.total.toFixed(6),
      row.durationMs,
      row.firstTokenMs,
      row.endpoint,
      row.ip,
    ]
      .map(csvCell)
      .join(','),
  );
  return [labels.headers.map(csvCell).join(','), ...lines].join('\r\n') + '\r\n';
}
