import { formatAmount } from '@/lib/catalog';
import { SITE } from '@/lib/site';

import type { LogRow } from './logs-types';

/**
 * 日志行上要算的东西：官方价单价、计费档、额外信息、输出速度、curl 示例。纯函数，单测锁住。
 */

const PER_MILLION = 1_000_000;
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** 官方价单价（美元 / 每百万 Token）：用这次的分项费用除以 Token 数反算，算不出来的为 null */
export function unitPrices(row: LogRow): { input: number | null; output: number | null } {
  const per = (cost: number, tokens: number) =>
    tokens > 0 && cost > 0 ? round6((cost / tokens) * PER_MILLION) : null;
  return {
    input: per(row.costs.input, row.tokens.input),
    output: per(row.costs.output, row.tokens.output),
  };
}

/** 模型单价的写法（和模型页、官网价格表一致）：$2、$0.25 */
export function formatUnitPrice(usd: number | null): string {
  return usd === null ? '—' : `$${formatAmount(usd)}`;
}

export type TierKey = 'standard' | 'priority' | 'flex';

/** 计费档：没写或 default 是标准；认不出的返回 null，界面原样显示 */
export function tierOf(serviceTier: string | null): TierKey | null {
  if (serviceTier === null || serviceTier === 'default' || serviceTier === 'standard') {
    return 'standard';
  }
  if (serviceTier === 'priority') return 'priority';
  if (serviceTier === 'flex') return 'flex';
  return null;
}

/** 计费格「+N」里的额外信息 */
export type LogExtra =
  | { kind: 'longContext' }
  | { kind: 'reasoning'; value: string }
  | { kind: 'images'; count: number; size: string | null };

export function logExtras(row: LogRow): LogExtra[] {
  const extras: LogExtra[] = [];
  if (row.longContext) extras.push({ kind: 'longContext' });
  if (row.reasoningEffort) extras.push({ kind: 'reasoning', value: row.reasoningEffort });
  if (row.images.count > 0)
    extras.push({ kind: 'images', count: row.images.count, size: row.images.size });
  return extras;
}

/** 输出速度（Token / 秒）= 输出 Token ÷ 总耗时；没有耗时或没有输出时为 null */
export function outputSpeed(row: LogRow): number | null {
  if (row.durationMs === null || row.durationMs <= 0 || row.tokens.output <= 0) return null;
  return Math.round(row.tokens.output / (row.durationMs / 1000));
}

/**
 * 「复制为 curl」：后端不存请求内容，只能按这次的接口路径和模型名给一个示意请求，
 * 密钥用环境变量占位。没有接口路径时，生图按生图接口、其余按对话接口。
 */
export function curlExample(row: LogRow): string {
  const path =
    row.endpoint ??
    (row.billingMode === 'image' ? '/v1/images/generations' : '/v1/chat/completions');
  const body = path.includes('/images/')
    ? { model: row.model, prompt: '…', size: row.images.size ?? '1024x1024' }
    : path.endsWith('/messages')
      ? {
          model: row.model,
          max_tokens: 1024,
          stream: row.stream,
          messages: [{ role: 'user', content: '…' }],
        }
      : path.endsWith('/responses')
        ? { model: row.model, stream: row.stream, input: '…' }
        : { model: row.model, stream: row.stream, messages: [{ role: 'user', content: '…' }] };
  return [
    `curl ${SITE.apiBase}${path} \\`,
    `  -H "Authorization: Bearer $CODU_API_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(body)}'`,
  ].join('\n');
}
