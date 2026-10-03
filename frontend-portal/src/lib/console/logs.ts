import { getModel, type EditionId, type ModelType } from '@/lib/catalog';
import { SITE } from '@/lib/site';

import { API_KEYS, keyActiveOn, USED_MODEL_IDS, type UsedModelId } from './keys';
import { between, createRandom, randomToken } from './random';
import {
  addDays,
  CONSOLE_NOW,
  dayKey,
  dayStart,
  formatDateTime,
  HOUR_MS,
  inRange,
  TODAY,
  type DateRange,
} from './time';
import { PROFILES, usageCost } from './usage';

/**
 * 请求日志（占位数据）：最近 30 天的 240 条请求样本，按时间倒序。
 * 只是样本，条数和用量页的合计没有一一对应关系。
 */
export type LogStatus = 'success' | 'error';
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'error';
export type LogErrorCode = 'upstream_timeout' | 'rate_limited' | 'context_length_exceeded';

export interface RequestLog {
  id: string;
  ts: number;
  keyId: string;
  modelId: UsedModelId;
  group: EditionId;
  type: ModelType;
  stream: boolean;
  inputTokens: number;
  cacheTokens: number;
  outputTokens: number;
  images: number;
  costUsd: number;
  durationMs: number;
  /** 首字耗时，只有流式文本请求有 */
  ttftMs: number | null;
  status: LogStatus;
  httpStatus: number;
  finishReason: FinishReason;
  errorCode: LogErrorCode | null;
  /** 调用方（User-Agent 的产品名与版本） */
  client: string;
}

const LOG_COUNT = 240;

/** 每个密钥常见的调用方 */
const CLIENTS: Record<string, readonly string[]> = {
  'key-prod': ['openai-python/1.99.1', 'node-fetch/3.3.2'],
  'key-claude-code': ['claude-cli/2.1.4'],
  'key-test': ['curl/8.7.1', 'PostmanRuntime/7.43.0'],
  'key-labeling': ['python-requests/2.32.3'],
  'key-legacy': ['axios/1.12.2'],
};

const ERRORS: readonly { code: LogErrorCode; http: number }[] = [
  { code: 'upstream_timeout', http: 504 },
  { code: 'rate_limited', http: 429 },
  { code: 'context_length_exceeded', http: 400 },
];

function pick<T>(random: () => number, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('pick from empty list');
  return item;
}

/** 按权重随机取一个 */
function pickWeighted<T>(random: () => number, items: readonly { item: T; weight: number }[]): T {
  const total = items.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of items) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  const last = items[items.length - 1];
  if (!last) throw new Error('pick from empty list');
  return last.item;
}

function generate(): RequestLog[] {
  const random = createRandom('console-logs');
  const logs: RequestLog[] = [];
  const firstDay = addDays(TODAY, -29);
  for (let i = 0; i < LOG_COUNT; i++) {
    // 越近的日子样本越多
    const day = addDays(firstDay, Math.floor(Math.sqrt(random()) * 30));
    const keys = API_KEYS.filter((key) => keyActiveOn(key, day));
    if (keys.length === 0) continue;
    const key = pickWeighted(
      random,
      keys.map((k) => ({ item: k, weight: k.share })),
    );
    const modelId = pickWeighted(
      random,
      USED_MODEL_IDS.filter((id) => key.mix[id] !== undefined).map((id) => ({
        item: id,
        weight: key.mix[id] ?? 0,
      })),
    );
    const latest = day === TODAY ? CONSOLE_NOW : dayStart(day) + 24 * HOUR_MS - 1000;
    const earliest = dayStart(day) + 7 * HOUR_MS;
    const ts = Math.floor(between(random, earliest, Math.max(earliest + 60_000, latest)));

    const profile = PROFILES[modelId];
    const isImage = getModel(modelId).type === 'image';
    const failed = random() < 0.035;
    const error = failed ? pick(random, ERRORS) : null;
    const inputAll = Math.round(profile.input * between(random, 0.3, 1.8));
    const cacheTokens = Math.round(inputAll * profile.cacheRatio * between(random, 0.6, 1.2));
    const usage = {
      inputTokens: Math.max(0, inputAll - cacheTokens),
      cacheTokens: Math.min(inputAll, cacheTokens),
      outputTokens: failed || isImage ? 0 : Math.round(profile.output * between(random, 0.2, 2)),
      images: isImage && !failed ? 1 : 0,
    };
    const stream = !isImage && random() < 0.8;
    const durationMs = failed
      ? Math.round(error?.code === 'upstream_timeout' ? 60_000 : between(random, 120, 900))
      : Math.round(profile.latencyMs * between(random, 0.4, 1.8));
    const finishRoll = random();
    logs.push({
      id: `req_${randomToken(random, 20)}`,
      ts,
      keyId: key.id,
      modelId,
      group: key.group,
      type: isImage ? 'image' : 'text',
      stream,
      ...usage,
      costUsd: failed ? 0 : usageCost(modelId, key.group, usage, 1),
      durationMs,
      ttftMs:
        stream && !failed
          ? Math.min(durationMs, Math.round(profile.ttftMs * between(random, 0.5, 1.6)))
          : null,
      status: failed ? 'error' : 'success',
      httpStatus: error?.http ?? 200,
      finishReason: failed
        ? 'error'
        : isImage || finishRoll < 0.88
          ? 'stop'
          : finishRoll < 0.94
            ? 'length'
            : 'tool_calls',
      errorCode: error?.code ?? null,
      client: pick(random, CLIENTS[key.id] ?? ['unknown']),
    });
  }
  return logs.sort((a, b) => b.ts - a.ts);
}

export const REQUEST_LOGS: readonly RequestLog[] = generate();

export type StreamFilter = 'all' | 'stream' | 'non-stream';

export interface LogFilter {
  range: DateRange;
  /** 密钥 id，'all' 表示不限 */
  keyId: string;
  /** 模型调用名，'all' 表示不限 */
  modelId: string;
  status: LogStatus | 'all';
  type: ModelType | 'all';
  stream: StreamFilter;
  /** 请求 ID（包含即可） */
  query: string;
}

export function filterLogs(logs: readonly RequestLog[], filter: LogFilter): RequestLog[] {
  const q = filter.query.trim().toLowerCase();
  return logs.filter(
    (log) =>
      inRange(dayKey(log.ts), filter.range) &&
      (filter.keyId === 'all' || log.keyId === filter.keyId) &&
      (filter.modelId === 'all' || log.modelId === filter.modelId) &&
      (filter.status === 'all' || log.status === filter.status) &&
      (filter.type === 'all' || log.type === filter.type) &&
      (filter.stream === 'all' || log.stream === (filter.stream === 'stream')) &&
      (q === '' || log.id.toLowerCase().includes(q)),
  );
}

const CSV_COLUMNS = [
  'time',
  'request_id',
  'key',
  'model',
  'group',
  'type',
  'stream',
  'input_tokens',
  'cache_tokens',
  'output_tokens',
  'images',
  'cost_usd',
  'duration_ms',
  'ttft_ms',
  'status',
  'http_status',
  'finish_reason',
  'client',
] as const;

/** CSV 单元格：含逗号、引号或换行时加引号，引号写两遍 */
export function csvCell(value: string | number | boolean | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 导出 CSV：时间按北京时间，密钥写名称 */
export function logsToCsv(logs: readonly RequestLog[]): string {
  const keyName = new Map(API_KEYS.map((key) => [key.id, key.name]));
  const rows = logs.map((log) =>
    [
      formatDateTime(log.ts),
      log.id,
      keyName.get(log.keyId) ?? log.keyId,
      log.modelId,
      log.group,
      log.type,
      log.stream,
      log.inputTokens,
      log.cacheTokens,
      log.outputTokens,
      log.images,
      log.costUsd,
      log.durationMs,
      log.ttftMs,
      log.status,
      log.httpStatus,
      log.finishReason,
      log.client,
    ]
      .map(csvCell)
      .join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\n');
}

/** 「复制为 curl」：按模型协议拼一条可以改改就用的请求（密钥用环境变量占位） */
export function curlFor(log: RequestLog): string {
  const model = getModel(log.modelId);
  const isAnthropic =
    model.protocols.includes('anthropic-messages') && model.provider === 'anthropic';
  const path =
    log.type === 'image'
      ? '/v1/images/generations'
      : isAnthropic
        ? '/v1/messages'
        : '/v1/chat/completions';
  const body =
    log.type === 'image'
      ? { model: log.modelId, prompt: '…', size: '1024x1024' }
      : isAnthropic
        ? {
            model: log.modelId,
            max_tokens: 1024,
            stream: log.stream,
            messages: [{ role: 'user', content: '…' }],
          }
        : { model: log.modelId, stream: log.stream, messages: [{ role: 'user', content: '…' }] };
  return [
    `curl ${SITE.apiBase}${path} \\`,
    `  -H "Authorization: Bearer $NEXUS_API_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(body)}'`,
  ].join('\n');
}
