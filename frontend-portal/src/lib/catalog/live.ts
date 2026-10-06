import type { ConsoleChannel } from '@/lib/console/live/models-types';
import { modelRows, type LivePrice } from '@/lib/console/live/models-view';

import type { ContextFilter, SortKey, TypeFilter } from './filter';
import { PROVIDERS } from './providers';
import type { ModelType, ProviderId } from './types';

/**
 * 官网（首页、模型页、价格页）的真实模型数据：后台「模型广场」的分组与单价 + 「服务状态」的渠道监测，
 * 由官网服务器读好、整理成这个形状再交给页面。纯函数，单测锁住。
 *
 * - 按分组展示：后台对访客开放的每个分组里的每个模型是一条，同一个模型在几个分组里就有几条，
 *   价格按各自分组的倍率算。「通道」只是官网上的说法，分组名里自己写明属于哪个通道。
 * - 价格已乘分组倍率（美元；按 Token 的是每百万 Token）。展示名、厂商、上下文、「新」标记取官网目录，
 *   目录里没有的模型显示原名。
 * - 可用率来自后台给这个模型建的监测项（名称 = 模型名、分组标签 = 分组名）；没建的模型没有这一块。
 */

/** 一次探测的结果：正常、变慢（仍可用）、不可用、无数据 */
export type ProbeStatus = 'up' | 'slow' | 'down' | 'unknown';

/** 后台的一个渠道监测项（对外服务状态里的一行） */
export interface StatusEntry {
  /** 监测项名称，官网按它对应模型名 */
  name: string;
  /** 分组标签，官网按它对应后台分组名 */
  group: string;
  /** 最近一次的对话延迟（发出到答完） */
  latencyMs: number | null;
  /** 最近一次的端点 PING（网络来回一趟） */
  pingMs: number | null;
  /** 近 7 天可用性，百分数 */
  availability: number;
  /** 最近的探测结果（最多 60 次），从早到晚 */
  probes: ProbeStatus[];
}

/** 模型卡上的可用率一块 */
export type ModelHealth = Omit<StatusEntry, 'name' | 'group'>;

/** 模型所在的后台分组 */
export interface SiteGroup {
  id: string;
  name: string;
}

/** 某个分组里的一个模型 */
export interface SiteModel {
  /** 分组 + 模型，全站唯一 */
  key: string;
  /** 调用时填的模型名 */
  id: string;
  name: string;
  group: SiteGroup;
  provider: ProviderId | null;
  type: ModelType;
  contextTokens: number | null;
  released: string | null;
  isNew: boolean;
  /** 实付价（已乘分组倍率） */
  price: LivePrice;
  /** 缓存读取价（每百万 Token，已乘分组倍率）；没有为 null */
  cacheRead: number | null;
  /** 实付 ÷ 官方价，小于 1 时显示折扣标 */
  discount: number | null;
  /** 价格排序用：按 Token 的取输入价，按次的取单价，没有价格的排最后 */
  sortPrice: number;
  health: ModelHealth | null;
}

/** 官网的全部模型（各分组摊平，顺序同后台）；后台没开模型广场或读不到时为 null */
export type SiteCatalog = SiteModel[] | null;

const PER_MILLION = 1_000_000;
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const healthKey = (group: string, name: string) =>
  `${group.trim().toLowerCase()}\u0000${name.trim().toLowerCase()}`;

function siteModels(
  channel: ConsoleChannel,
  health: ReadonlyMap<string, StatusEntry>,
): SiteModel[] {
  const sources = new Map(channel.models.map((model) => [model.id, model]));
  return modelRows(channel).map((row) => {
    const cacheRead = sources.get(row.id)?.cacheRead ?? null;
    const entry = health.get(healthKey(channel.name, row.id));
    return {
      key: row.key,
      id: row.id,
      name: row.name,
      group: { id: channel.id, name: channel.name },
      provider: row.provider,
      type: row.type,
      contextTokens: row.contextTokens,
      released: row.released,
      isNew: row.isNew,
      price: row.price,
      cacheRead: cacheRead === null ? null : round6(cacheRead * PER_MILLION * channel.rate),
      discount: row.discount,
      sortPrice: row.sortPrice,
      health: entry
        ? {
            latencyMs: entry.latencyMs,
            pingMs: entry.pingMs,
            availability: entry.availability,
            probes: entry.probes,
          }
        : null,
    };
  });
}

/** 后台的分组与监测 → 官网的全部模型；后台没开模型广场或读不到时为 null */
export function buildSiteCatalog(
  channels: readonly ConsoleChannel[] | null,
  status: readonly StatusEntry[] | null,
): SiteCatalog {
  if (!channels) return null;
  const health = new Map<string, StatusEntry>();
  for (const entry of status ?? []) {
    const key = healthKey(entry.group, entry.name);
    if (!health.has(key)) health.set(key, entry);
  }
  return channels.flatMap((channel) => siteModels(channel, health));
}

/** 价目表里某个分组某个模型那一行的锚点（模型卡「查看价格」跳到这里） */
export function priceRowId(model: SiteModel): string {
  return `model-${model.group.id}-${model.id}`;
}

/** 不重复的模型数（同一个模型在几个分组里只算一个） */
export function distinctModelCount(models: readonly SiteModel[]): number {
  return new Set(models.map((model) => model.id)).size;
}

/** 首页、模型页标题里的模型数；后台读不到或没有模型时为 null */
export function siteModelCount(catalog: SiteCatalog): number | null {
  const count = catalog ? distinctModelCount(catalog) : 0;
  return count > 0 ? count : null;
}

/* ---------- 模型页的筛选与排序 ---------- */

export interface SiteModelsQuery {
  type: TypeFilter;
  /** 空数组表示不限厂商 */
  providers: readonly ProviderId[];
  context: ContextFilter;
  query: string;
  sort: SortKey;
}

const CONTEXT_MIN: Record<ContextFilter, number> = { all: 0, '200k': 200_000, '1m': 1_000_000 };
const PROVIDER_NAME = new Map(PROVIDERS.map((provider) => [provider.id, provider.name]));
const typeOrder = (model: SiteModel) => (model.type === 'text' ? 0 : 1);

/** 没有值的排在最后；有值的按 direction 排 */
function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number {
  const aMissing = a === null || !Number.isFinite(a);
  const bMissing = b === null || !Number.isFinite(b);
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
  return (a - b) * direction;
}

/** 按模型名排，同名的再按调用名，保证同一个模型的几条挨着 */
const byName = (a: SiteModel, b: SiteModel) =>
  a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en');

/** 同一个模型的几条：便宜的分组在前，一样贵按分组名 */
const byOffer = (a: SiteModel, b: SiteModel) =>
  compareNullable(a.sortPrice, b.sortPrice, 1) || a.group.name.localeCompare(b.group.name);

function matchesQuery(model: SiteModel, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  return [
    model.name,
    model.id,
    model.group.name,
    model.provider ? (PROVIDER_NAME.get(model.provider) ?? '') : '',
  ].some((value) => value.toLowerCase().includes(text));
}

/**
 * 模型页的筛选与排序：最新按上线日期（目录里没有的排后），价格排序时文本在前、生图在后；
 * 关键词也搜分组名（搜「共享」就只剩名字里带共享的分组）。同一个模型的几条挨着、便宜的在前。
 */
export function filterSiteModels(
  models: readonly SiteModel[],
  query: SiteModelsQuery,
): SiteModel[] {
  const min = CONTEXT_MIN[query.context];
  const result = models.filter(
    (model) =>
      (query.type === 'all' || model.type === query.type) &&
      (query.providers.length === 0 ||
        (model.provider !== null && query.providers.includes(model.provider))) &&
      (min === 0 || (model.contextTokens ?? 0) >= min) &&
      matchesQuery(model, query.query),
  );
  switch (query.sort) {
    case 'latest':
      return result.sort(
        (a, b) =>
          (a.released === b.released
            ? 0
            : a.released === null
              ? 1
              : b.released === null
                ? -1
                : b.released.localeCompare(a.released)) ||
          byName(a, b) ||
          byOffer(a, b),
      );
    case 'price-asc':
    case 'price-desc':
      return result.sort(
        (a, b) =>
          typeOrder(a) - typeOrder(b) ||
          compareNullable(a.sortPrice, b.sortPrice, query.sort === 'price-asc' ? 1 : -1) ||
          byName(a, b) ||
          a.group.name.localeCompare(b.group.name),
      );
    case 'context':
      return result.sort(
        (a, b) =>
          compareNullable(a.contextTokens, b.contextTokens, -1) || byName(a, b) || byOffer(a, b),
      );
  }
}

export interface SiteFacetCounts {
  types: Record<TypeFilter, number>;
  providers: Partial<Record<ProviderId, number>>;
}

/** 筛选栏上的数量（都按不重复的模型算）：类型按全部模型；厂商只按当前类型 */
export function siteFacetCounts(models: readonly SiteModel[], type: TypeFilter): SiteFacetCounts {
  const providers: Partial<Record<ProviderId, number>> = {};
  const seen = new Set<string>();
  for (const model of models) {
    if (model.provider === null || (type !== 'all' && model.type !== type)) continue;
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    providers[model.provider] = (providers[model.provider] ?? 0) + 1;
  }
  return {
    types: {
      all: distinctModelCount(models),
      text: distinctModelCount(models.filter((model) => model.type === 'text')),
      image: distinctModelCount(models.filter((model) => model.type === 'image')),
    },
    providers,
  };
}

/** 筛选栏的厂商：只列出现过的，顺序同官网目录 */
export function providersOf(models: readonly SiteModel[]): ProviderId[] {
  const present = new Set(models.map((model) => model.provider));
  return PROVIDERS.filter((provider) => present.has(provider.id)).map((provider) => provider.id);
}

/* ---------- 价目表与首页 ---------- */

/** 价目表里的一个模型：它在各分组的价格（一个分组一行），便宜的在前 */
export interface SiteModelEntry {
  /** 调用时填的模型名 */
  id: string;
  provider: ProviderId | null;
  rows: SiteModel[];
}

/**
 * 价目表按厂商分段，顺序同官网目录，认不出厂商的放在最后一段（provider 为 null）；
 * 段内的模型按在后台第一次出现的顺序，同一个模型的几个分组合成一项。
 */
export function groupSiteModels(
  models: readonly SiteModel[],
): { provider: ProviderId | null; entries: SiteModelEntry[] }[] {
  const entries = new Map<string, SiteModelEntry>();
  for (const model of models) {
    const entry = entries.get(model.id);
    if (entry) entry.rows.push(model);
    else entries.set(model.id, { id: model.id, provider: model.provider, rows: [model] });
  }
  const all = [...entries.values()].map((entry) => ({
    ...entry,
    rows: [...entry.rows].sort(byOffer),
  }));
  const sections: { provider: ProviderId | null; entries: SiteModelEntry[] }[] = PROVIDERS.map(
    (provider) => ({
      provider: provider.id,
      entries: all.filter((entry) => entry.provider === provider.id),
    }),
  );
  sections.push({ provider: null, entries: all.filter((entry) => entry.provider === null) });
  return sections.filter((section) => section.entries.length > 0);
}

/** 首页瀑布流的一张卡 */
export interface CheapestModel {
  /** 这个模型最便宜的那个分组 */
  model: SiteModel;
  /** 同一个模型还有更贵的分组（价格后面写「起」） */
  from: boolean;
}

const LATEST: SiteModelsQuery = {
  type: 'all',
  providers: [],
  context: 'all',
  query: '',
  sort: 'latest',
};

/** 首页瀑布流：每个模型一张卡，取最便宜的分组；顺序同模型页「最新」 */
export function cheapestPerModel(models: readonly SiteModel[]): CheapestModel[] {
  const best = new Map<string, SiteModel>();
  const pricier = new Set<string>();
  for (const model of models) {
    const current = best.get(model.id);
    if (!current) {
      best.set(model.id, model);
      continue;
    }
    if (
      Number.isFinite(current.sortPrice) &&
      Number.isFinite(model.sortPrice) &&
      current.sortPrice !== model.sortPrice
    ) {
      pricier.add(model.id);
    }
    if (byOffer(model, current) < 0) best.set(model.id, model);
  }
  return filterSiteModels([...best.values()], LATEST).map((model) => ({
    model,
    from: pricier.has(model.id),
  }));
}
