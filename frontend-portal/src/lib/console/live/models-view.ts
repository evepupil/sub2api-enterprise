import {
  formatAmount,
  isNewModel,
  MODELS,
  PROVIDERS,
  type ContextFilter,
  type Model,
  type ModelType,
  type Protocol,
  type Provider,
  type ProviderId,
  type SortKey,
  type TypeFilter,
} from '@/lib/catalog';

import type { ChannelModel, ConsoleChannel, TimeWindow, TokenRates } from './models-types';

/**
 * 控制台模型页：后端分组数据 + 官网模型目录 → 表格里的一行。纯函数，单测锁住。
 * 所有分组的模型摊在同一张表里（2026-10-04 用户要求），每行是「一个分组里的一个模型」，带着分组名与倍率。
 * 价格、官方价、计费方式来自后端；展示名、厂商、类型、协议、上下文、「新」标记来自官网目录，
 * 目录里没有的模型显示原名，厂商按模型名猜，协议按后端平台推，上下文未知。
 */

/** 实付价（美元，已乘分组倍率；按 Token 的是每百万 Token） */
export type LivePrice =
  | {
      kind: 'token';
      input: number | null;
      output: number | null;
      /** 超过 threshold 个输入 Token 后的单价（分组按长上下文分档计费时才有） */
      longContext: { threshold: number; input: number | null; output: number | null } | null;
    }
  | { kind: 'request'; unit: 'image' | 'request'; price: number; from: boolean }
  | { kind: 'none' };

/** 价格下方的时段说明：分组高峰，或模型的分时段价 */
export interface PriceWindow extends TimeWindow {
  kind: 'peak' | 'time';
  weekdaysOnly: boolean;
}

/** 这一行属于哪个分组 */
export interface RowChannel {
  id: string;
  name: string;
  /** 生效倍率（专属倍率优先） */
  rate: number;
}

export interface ModelRowView {
  /** 分组 ID + 模型名，表格里唯一 */
  key: string;
  channel: RowChannel;
  /** 调用时填的模型名 */
  id: string;
  name: string;
  provider: ProviderId | null;
  type: ModelType;
  protocols: readonly Protocol[];
  contextTokens: number | null;
  /** 上线日期，目录里没有的模型为 null */
  released: string | null;
  isNew: boolean;
  price: LivePrice;
  /** 官方价（每百万 Token，不乘倍率），只有按 Token 计费且后端查得到时才有 */
  official: TokenRates | null;
  /** 实付 ÷ 官方，小于 1 时显示折扣标 */
  discount: number | null;
  windows: PriceWindow[];
  /** 价格排序用：按 Token 的取输入价，按次的取单价，没有价格的排最后 */
  sortPrice: number;
}

export interface ModelsQuery {
  type: TypeFilter;
  provider: ProviderId | 'all';
  context: ContextFilter;
  protocol: Protocol | 'all';
  query: string;
  sort: SortKey;
}

const PER_MILLION = 1_000_000;
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

const CATALOG = new Map(MODELS.map((model) => [model.id.toLowerCase(), model]));

/** 官网目录里的同名模型（不分大小写） */
export function catalogEntry(id: string): Model | null {
  return CATALOG.get(id.toLowerCase()) ?? null;
}

/** 目录里没有的模型按名字猜厂商；猜不到为 null */
const PROVIDER_PREFIXES: readonly (readonly [RegExp, ProviderId])[] = [
  [/^(gpt|o\d|chatgpt|codex|dall-e|sora)/i, 'openai'],
  [/^claude/i, 'anthropic'],
  [/^(gemini|imagen|veo|nano-banana)/i, 'google'],
  [/^deepseek/i, 'deepseek'],
  [/^(kimi|moonshot)/i, 'moonshot'],
  [/^(glm|chatglm|cogview)/i, 'zhipu'],
  [/^(minimax|abab|hailuo)/i, 'minimax'],
  [/^(qwen|qwq|wan)/i, 'qwen'],
];

export function inferProvider(id: string): ProviderId | null {
  return PROVIDER_PREFIXES.find(([pattern]) => pattern.test(id))?.[1] ?? null;
}

/** 目录里没有的模型按后端平台推协议；推不出来为空 */
export function inferProtocols(id: string, platform: string, type: ModelType): Protocol[] {
  if (platform === 'openai')
    return type === 'image' ? ['openai-images'] : ['openai-chat', 'openai-responses'];
  if (platform === 'anthropic') return ['anthropic-messages'];
  if (platform === 'gemini') return ['gemini'];
  if (platform === 'antigravity') {
    if (/^claude/i.test(id)) return ['anthropic-messages'];
    if (/^gemini/i.test(id)) return ['gemini'];
  }
  return [];
}

const perMillion = (perToken: number | null, rate: number): number | null =>
  perToken === null ? null : round6(perToken * PER_MILLION * rate);

function livePrice(model: ChannelModel, channel: ConsoleChannel): LivePrice {
  if (model.billing === 'token') {
    const rate = channel.rate;
    const tier = channel.longContext ? (model.tiers.find((t) => t.minTokens > 0) ?? null) : null;
    return {
      kind: 'token',
      input: perMillion(model.base.input, rate),
      output: perMillion(model.base.output, rate),
      longContext: tier
        ? {
            threshold: tier.minTokens,
            input: perMillion(tier.input, rate),
            output: perMillion(tier.output, rate),
          }
        : null,
    };
  }
  if (model.perRequest === null) return { kind: 'none' };
  const rate =
    model.billing === 'image' && channel.imageRate !== null ? channel.imageRate : channel.rate;
  return {
    kind: 'request',
    unit: model.billing === 'image' ? 'image' : 'request',
    price: round6(model.perRequest * rate),
    from: model.perRequestTiered,
  };
}

/** 折扣 = 实付 ÷ 官方：优先比输出价，没有再比输入价；不打折（≥ 1）时不显示 */
function discountOf(price: LivePrice, official: TokenRates | null): number | null {
  if (price.kind !== 'token' || !official) return null;
  const pairs: readonly (readonly [number | null, number | null])[] = [
    [price.output, official.output],
    [price.input, official.input],
  ];
  for (const [paid, base] of pairs) {
    if (paid !== null && base !== null && base > 0) {
      const ratio = Math.round((paid / base) * 10_000) / 10_000;
      return ratio < 1 ? ratio : null;
    }
  }
  return null;
}

function sortPriceOf(price: LivePrice): number {
  if (price.kind === 'token') return price.input ?? price.output ?? Number.POSITIVE_INFINITY;
  if (price.kind === 'request') return price.price;
  return Number.POSITIVE_INFINITY;
}

function toRow(model: ChannelModel, channel: ConsoleChannel): ModelRowView {
  const meta = catalogEntry(model.id);
  const type: ModelType = meta?.type ?? (model.billing === 'image' ? 'image' : 'text');
  const price = livePrice(model, channel);
  const official =
    model.billing === 'token' && model.official
      ? { input: perMillion(model.official.input, 1), output: perMillion(model.official.output, 1) }
      : null;
  const windows: PriceWindow[] = [
    ...(channel.peak ? [{ ...channel.peak, kind: 'peak' as const, weekdaysOnly: false }] : []),
    ...(model.timePricing?.windows.map((window) => ({
      ...window,
      kind: 'time' as const,
      weekdaysOnly: model.timePricing?.weekdaysOnly ?? false,
    })) ?? []),
  ];
  return {
    key: `${channel.id}:${model.id}`,
    channel: { id: channel.id, name: channel.name, rate: channel.rate },
    id: model.id,
    name: meta?.name ?? model.id,
    provider: meta?.provider ?? inferProvider(model.id),
    type,
    protocols: meta?.protocols ?? inferProtocols(model.id, model.platform, type),
    contextTokens: meta?.contextTokens ?? null,
    released: meta?.released ?? null,
    isNew: meta ? isNewModel(meta) : false,
    price,
    official,
    discount: discountOf(price, official),
    windows,
    sortPrice: sortPriceOf(price),
  };
}

/** 一个分组里的全部模型行（顺序由排序决定） */
export function modelRows(channel: ConsoleChannel): ModelRowView[] {
  return channel.models.map((model) => toRow(model, channel));
}

/** 所有分组的模型摊成一张表：同一个模型在几个分组里就有几行，价格按各自分组的倍率算 */
export function allModelRows(channels: readonly ConsoleChannel[]): ModelRowView[] {
  return channels.flatMap(modelRows);
}

const CONTEXT_MIN: Record<ContextFilter, number> = { all: 0, '200k': 200_000, '1m': 1_000_000 };
const PROVIDER_NAME = new Map(PROVIDERS.map((provider) => [provider.id, provider.name]));

/** 没有值的排在最后；有值的按 direction 排 */
function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null || !Number.isFinite(a)) return b === null || !Number.isFinite(b) ? 0 : 1;
  if (b === null || !Number.isFinite(b)) return -1;
  return (a - b) * direction;
}

function comparator(sort: SortKey): (a: ModelRowView, b: ModelRowView) => number {
  // 同一个模型的几行挨着放，倍率低的分组在前
  const byName = (a: ModelRowView, b: ModelRowView) =>
    a.id.localeCompare(b.id) ||
    a.channel.rate - b.channel.rate ||
    a.channel.name.localeCompare(b.channel.name);
  switch (sort) {
    case 'latest':
      return (a, b) =>
        a.released === b.released
          ? byName(a, b)
          : a.released === null
            ? 1
            : b.released === null
              ? -1
              : b.released.localeCompare(a.released);
    case 'price-asc':
      return (a, b) => compareNullable(a.sortPrice, b.sortPrice, 1) || byName(a, b);
    case 'price-desc':
      return (a, b) => compareNullable(a.sortPrice, b.sortPrice, -1) || byName(a, b);
    case 'context':
      return (a, b) => compareNullable(a.contextTokens, b.contextTokens, -1) || byName(a, b);
  }
}

/** 按类型、厂商、上下文、协议、关键词（模型名、厂商、分组名）筛选后排序；上下文未知的模型在按上下文筛选时不出现 */
export function filterRows(rows: readonly ModelRowView[], query: ModelsQuery): ModelRowView[] {
  const text = query.query.trim().toLowerCase();
  const minContext = CONTEXT_MIN[query.context];
  return rows
    .filter(
      (row) =>
        (query.type === 'all' || row.type === query.type) &&
        (query.provider === 'all' || row.provider === query.provider) &&
        (query.protocol === 'all' || row.protocols.includes(query.protocol)) &&
        (minContext === 0 || (row.contextTokens ?? 0) >= minContext) &&
        (text === '' ||
          row.id.toLowerCase().includes(text) ||
          row.name.toLowerCase().includes(text) ||
          row.channel.name.toLowerCase().includes(text) ||
          (row.provider !== null &&
            (PROVIDER_NAME.get(row.provider) ?? '').toLowerCase().includes(text))),
    )
    .sort(comparator(query.sort));
}

/** 筛选栏的厂商选项：只列这个分组里出现过的厂商，顺序同官网目录 */
export function providersIn(rows: readonly ModelRowView[]): Provider[] {
  const present = new Set(rows.map((row) => row.provider));
  return PROVIDERS.filter((provider) => present.has(provider.id));
}

/** 美元金额：$4.5（价格只写美元，充值 1 元 = 1 美元） */
export function formatLiveMoney(usd: number): string {
  return `$${formatAmount(usd)}`;
}
