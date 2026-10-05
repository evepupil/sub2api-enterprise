import type { ConsoleChannel } from '@/lib/console/live/models-types';
import { modelRows, type LivePrice } from '@/lib/console/live/models-view';

import type { ContextFilter, SortKey, TypeFilter } from './filter';
import { PROVIDERS } from './providers';
import type { ModelType, ProviderId } from './types';

/**
 * 官网（首页、模型页、价格页）的真实模型数据：后台「模型广场」的分组与单价 + 「服务状态」的渠道监测，
 * 由官网服务器读好、整理成这个形状再交给页面。纯函数，单测锁住。
 *
 * - 官网的共享通道、专用通道按名字对应后台的同名分组（名字可在设置里改，见 parseChannelGroups）；
 *   企业通道按合同定价，不出单价。
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

export interface SiteModel {
  /** 调用时填的模型名 */
  id: string;
  name: string;
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

/** 官网有公开单价的通道（企业通道按合同定价） */
export const PRICED_EDITIONS = ['personal', 'pro'] as const;
export type PricedEdition = (typeof PRICED_EDITIONS)[number];

/** 每个通道的模型；null 表示后台读不到，或后台没有对应的分组 */
export type SiteCatalog = Record<PricedEdition, SiteModel[] | null>;

export const EMPTY_SITE_CATALOG: SiteCatalog = { personal: null, pro: null };

export function isPricedEdition(value: string): value is PricedEdition {
  return (PRICED_EDITIONS as readonly string[]).includes(value);
}

/** 官网通道对应的后台分组名：默认同名 */
export const DEFAULT_CHANNEL_GROUPS: Record<PricedEdition, string> = {
  personal: '共享通道',
  pro: '专用通道',
};

/** 「personal=标准通道,pro=高性能通道」→ 每个通道对应的后台分组名；没写或写错的用默认 */
export function parseChannelGroups(text: string | undefined): Record<PricedEdition, string> {
  const groups = { ...DEFAULT_CHANNEL_GROUPS };
  for (const part of (text ?? '').split(',')) {
    const [edition, name] = part.split('=').map((value) => value.trim());
    if (edition && name && isPricedEdition(edition)) groups[edition] = name;
  }
  return groups;
}

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
      id: row.id,
      name: row.name,
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

/** 后台的分组与监测 → 官网每个通道的模型；后台没开模型广场或读不到时整体为空 */
export function buildSiteCatalog(
  channels: readonly ConsoleChannel[] | null,
  status: readonly StatusEntry[] | null,
  groups: Record<PricedEdition, string>,
): SiteCatalog {
  if (!channels) return EMPTY_SITE_CATALOG;
  const health = new Map<string, StatusEntry>();
  for (const entry of status ?? []) {
    const key = healthKey(entry.group, entry.name);
    if (!health.has(key)) health.set(key, entry);
  }
  const catalog: SiteCatalog = { ...EMPTY_SITE_CATALOG };
  for (const edition of PRICED_EDITIONS) {
    const channel = channels.find((item) => item.name.trim() === groups[edition].trim());
    catalog[edition] = channel ? siteModels(channel, health) : null;
  }
  return catalog;
}

/** 首页、各页数量用：有数据的通道里模型最多的那个；都没有时为 null */
export function siteModelCount(catalog: SiteCatalog): number | null {
  const counts = PRICED_EDITIONS.map((edition) => catalog[edition]?.length ?? null).filter(
    (count): count is number => count !== null && count > 0,
  );
  return counts.length > 0 ? Math.max(...counts) : null;
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
const byName = (a: SiteModel, b: SiteModel) => a.name.localeCompare(b.name, 'en');
const typeOrder = (model: SiteModel) => (model.type === 'text' ? 0 : 1);

function matchesQuery(model: SiteModel, query: string): boolean {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  return [
    model.name,
    model.id,
    model.provider ? (PROVIDER_NAME.get(model.provider) ?? '') : '',
  ].some((value) => value.toLowerCase().includes(text));
}

/** 没有值的排在最后；有值的按 direction 排 */
function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number {
  const aMissing = a === null || !Number.isFinite(a);
  const bMissing = b === null || !Number.isFinite(b);
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
  return (a - b) * direction;
}

/** 模型页的筛选与排序：最新按上线日期（目录里没有的排后），价格排序时文本在前、生图在后 */
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
                : b.released.localeCompare(a.released)) || byName(a, b),
      );
    case 'price-asc':
    case 'price-desc':
      return result.sort(
        (a, b) =>
          typeOrder(a) - typeOrder(b) ||
          compareNullable(a.sortPrice, b.sortPrice, query.sort === 'price-asc' ? 1 : -1) ||
          byName(a, b),
      );
    case 'context':
      return result.sort(
        (a, b) => compareNullable(a.contextTokens, b.contextTokens, -1) || byName(a, b),
      );
  }
}

export interface SiteFacetCounts {
  types: Record<TypeFilter, number>;
  providers: Partial<Record<ProviderId, number>>;
}

/** 筛选栏上的数量：类型按全部模型数；厂商只按当前类型数 */
export function siteFacetCounts(models: readonly SiteModel[], type: TypeFilter): SiteFacetCounts {
  const providers: Partial<Record<ProviderId, number>> = {};
  for (const model of models) {
    if (model.provider === null || (type !== 'all' && model.type !== type)) continue;
    providers[model.provider] = (providers[model.provider] ?? 0) + 1;
  }
  return {
    types: {
      all: models.length,
      text: models.filter((model) => model.type === 'text').length,
      image: models.filter((model) => model.type === 'image').length,
    },
    providers,
  };
}

/** 筛选栏的厂商：只列出现过的，顺序同官网目录 */
export function providersOf(models: readonly SiteModel[]): ProviderId[] {
  const present = new Set(models.map((model) => model.provider));
  return PROVIDERS.filter((provider) => present.has(provider.id)).map((provider) => provider.id);
}

/** 价目表按厂商分段，顺序同官网目录；认不出厂商的放在最后一段（provider 为 null） */
export function groupSiteModels(
  models: readonly SiteModel[],
): { provider: ProviderId | null; models: SiteModel[] }[] {
  const sections: { provider: ProviderId | null; models: SiteModel[] }[] = PROVIDERS.map(
    (provider) => ({
      provider: provider.id,
      models: models.filter((model) => model.provider === provider.id),
    }),
  );
  sections.push({ provider: null, models: models.filter((model) => model.provider === null) });
  return sections.filter((section) => section.models.length > 0);
}
