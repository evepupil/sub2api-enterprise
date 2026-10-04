import { SITE } from '@/lib/site';

import type { LogRow } from './logs-types';

/**
 * 日志行上要算的东西：费用明细、Fast 模式、输出速度、curl 示例。纯函数，单测锁住。
 */

const TOKENS_PER_MILLION = 1_000_000;

/**
 * 加价的快速模式：Codex 的 Fast、Claude 的 fast 模式（后端记成 priority 或 fast），以及 Codex 的 Ultrafast。
 * 后端默认按两倍计费；普通调用和低价的 flex 返回 null，界面上不标。
 */
export type FastMode = 'fast' | 'ultrafast';

export function fastModeOf(serviceTier: string | null): FastMode | null {
  const tier = serviceTier?.trim().toLowerCase();
  if (tier === 'priority' || tier === 'fast') return 'fast';
  if (tier === 'ultrafast') return 'ultrafast';
  return null;
}

/** 费用明细里的一项；值的写法由界面按类型决定 */
export type CostValue =
  /** 美元金额 */
  | { type: 'usd'; amount: number }
  /** 每百万 Token 的单价；Token 数为 0 算不出来时为 null */
  | { type: 'perMillion'; amount: number | null }
  | { type: 'images'; count: number }
  /** 原样显示的文字（尺寸、各尺寸张数） */
  | { type: 'text'; text: string }
  /** 没记录或认不出的尺寸、尺寸来源，界面按语言写 */
  | { type: 'note'; note: CostNote }
  /** 老记录里不在 1K / 2K / 4K / mixed 之内的计费尺寸 */
  | { type: 'legacySize'; size: string };

export type CostNote =
  | 'notRecorded'
  | 'unknown'
  | 'sourceOutput'
  | 'sourceInput'
  | 'sourceDefault'
  | 'sourceLegacy'
  | 'sourceMissing';

export type CostLineKey =
  | 'inputCost'
  | 'imageInputCost'
  | 'outputCost'
  | 'imageOutputCost'
  | 'inputPrice'
  | 'imageInputPrice'
  | 'outputPrice'
  | 'imageOutputPrice'
  | 'imageCount'
  | 'imageBillingSize'
  | 'imageSizeSource'
  | 'imageInputSize'
  | 'imageOutputSize'
  | 'imageSizeBreakdown'
  | 'imageUnitPrice'
  | 'imageTotalPrice'
  | 'requestPrice'
  | 'cacheWriteCost'
  | 'cacheReadCost';

export interface CostLine {
  key: CostLineKey;
  value: CostValue;
}

/** 服务档位：认得的四种按名字显示，别的原样显示 */
export type CostTier =
  | { kind: 'known'; tier: 'standard' | 'fast' | 'ultrafast' | 'flex' }
  | { kind: 'raw'; value: string };

export interface CostBreakdown {
  lines: CostLine[];
  tier: CostTier;
  rate: number;
  /** 没乘倍率的费用（sub2api 里叫「原始」） */
  original: number;
  /** 实际扣费 */
  billed: number;
}

const usd = (amount: number): CostValue => ({ type: 'usd', amount });

/** 单价 = 这部分费用 ÷ Token 数 × 一百万（和 sub2api 一样用这次的费用反算） */
function perMillion(cost: number, tokens: number): CostValue {
  return {
    type: 'perMillion',
    amount: tokens > 0 && Number.isFinite(cost) ? (cost / tokens) * TOKENS_PER_MILLION : null,
  };
}

const BILLING_SIZES = new Set(['1K', '2K', '4K', 'mixed']);
const SIZE_SOURCES: Record<string, CostNote> = {
  output: 'sourceOutput',
  input: 'sourceInput',
  default: 'sourceDefault',
  legacy: 'sourceLegacy',
};

/** 生图调用：有张数，且计费方式不是按 Token、按条（视频） */
function isImageUsage(row: LogRow): boolean {
  return row.images.count > 0 && row.billingMode !== 'token' && row.billingMode !== 'video';
}

function imageLines(row: LogRow): CostLine[] {
  const { images } = row;
  const size = images.size?.trim() ?? '';
  const source = images.sizeSource?.trim().toLowerCase() ?? '';
  const breakdown = ['1K', '2K', '4K']
    .filter((tier) => (images.breakdown[tier] ?? 0) > 0)
    .map((tier) => `${tier} x ${images.breakdown[tier]}`)
    .join(', ');
  const unitPrice = row.costs.total / images.count;
  return [
    { key: 'imageCount', value: { type: 'images', count: images.count } },
    {
      key: 'imageBillingSize',
      value: !size
        ? { type: 'note', note: 'notRecorded' }
        : BILLING_SIZES.has(size)
          ? { type: 'text', text: size }
          : { type: 'legacySize', size },
    },
    {
      key: 'imageSizeSource',
      value: {
        type: 'note',
        note: SIZE_SOURCES[source] ?? (size ? 'sourceLegacy' : 'sourceMissing'),
      },
    },
    {
      key: 'imageInputSize',
      value: images.inputSize?.trim()
        ? { type: 'text', text: images.inputSize.trim() }
        : { type: 'note', note: 'unknown' },
    },
    {
      key: 'imageOutputSize',
      value: images.outputSize?.trim()
        ? { type: 'text', text: images.outputSize.trim() }
        : { type: 'note', note: 'unknown' },
    },
    ...(breakdown
      ? [{ key: 'imageSizeBreakdown' as const, value: { type: 'text' as const, text: breakdown } }]
      : []),
    { key: 'imageUnitPrice', value: usd(Number.isFinite(unitPrice) ? unitPrice : 0) },
    { key: 'imageTotalPrice', value: usd(row.costs.total) },
  ];
}

/**
 * 费用明细（用户 2026-10-04 要求和 sub2api 使用记录里费用旁的悬浮明细一致）：
 * 先列有的分项费用；按 Token 计费的再列由这次费用反算的单价，生图列张数、尺寸和单张价格，
 * 其余（按次、视频）列单次价格；然后是缓存费用。下面是服务档位、倍率、原始与实际扣费。
 */
export function costBreakdown(row: LogRow): CostBreakdown {
  const { costs, tokens, images } = row;
  const textInput = Math.max(0, tokens.input - images.inputTokens);
  const textOutput = Math.max(0, tokens.output - images.outputTokens);
  const lines: CostLine[] = [];
  const add = (key: CostLineKey, value: CostValue, when = true) => {
    if (when) lines.push({ key, value });
  };

  add('inputCost', usd(costs.input), costs.input > 0);
  add('imageInputCost', usd(images.inputCost), images.inputCost > 0);
  add('outputCost', usd(costs.output), costs.output > 0);
  add('imageOutputCost', usd(images.outputCost), images.outputCost > 0);

  if (!isImageUsage(row) && (row.billingMode === null || row.billingMode === 'token')) {
    add('inputPrice', perMillion(costs.input, textInput), textInput > 0);
    add(
      'imageInputPrice',
      perMillion(images.inputCost, images.inputTokens),
      images.inputTokens > 0,
    );
    add('outputPrice', perMillion(costs.output, textOutput), costs.output > 0 && textOutput > 0);
    add(
      'imageOutputPrice',
      perMillion(images.outputCost, images.outputTokens),
      images.outputTokens > 0,
    );
  } else if (isImageUsage(row)) {
    lines.push(...imageLines(row));
  } else {
    add('requestPrice', usd(costs.total));
  }

  add('cacheWriteCost', usd(costs.cacheWrite), costs.cacheWrite > 0);
  add('cacheReadCost', usd(costs.cacheRead), costs.cacheRead > 0);

  return {
    lines,
    tier: costTier(row.serviceTier),
    rate: row.rate,
    original: costs.total,
    billed: row.actualCost,
  };
}

/** 服务档位：没写、default 都是标准；fast 和 priority 是同一个 Fast */
export function costTier(serviceTier: string | null): CostTier {
  const tier = serviceTier?.trim().toLowerCase() ?? '';
  if (tier === '' || tier === 'default' || tier === 'standard') {
    return { kind: 'known', tier: 'standard' };
  }
  if (tier === 'priority' || tier === 'fast') return { kind: 'known', tier: 'fast' };
  if (tier === 'ultrafast' || tier === 'flex') return { kind: 'known', tier };
  return { kind: 'raw', value: tier };
}

/** 费用明细里的金额：保留 6 位小数（和 sub2api 一致，比表格里的费用列更细） */
export function formatPreciseUsd(amount: number): string {
  return `US$${amount.toFixed(6)}`;
}

/** 费用明细里的单价：保留 4 位小数；算不出来写「-」 */
export function formatPerMillion(amount: number | null): string {
  return amount === null ? '-' : `US$${amount.toFixed(4)}`;
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
