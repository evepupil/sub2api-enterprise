import { getProvider, PROVIDERS } from './providers';
import { priceSortKey } from './pricing';
import type { EditionId, Model, ModelType, Protocol, ProviderId } from './types';

export type TypeFilter = 'all' | ModelType;
export type ContextFilter = 'all' | '200k' | '1m';
export type SortKey = 'latest' | 'price-asc' | 'price-desc' | 'context';

export const TYPE_FILTERS: readonly TypeFilter[] = ['all', 'text', 'image'];
export const CONTEXT_FILTERS: readonly ContextFilter[] = ['all', '200k', '1m'];
export const SORT_KEYS: readonly SortKey[] = ['latest', 'price-asc', 'price-desc', 'context'];
export const PROTOCOLS: readonly Protocol[] = [
  'openai-chat',
  'openai-responses',
  'anthropic-messages',
  'gemini',
  'openai-images',
];

/** 协议的展示名，不随语言变化 */
export const PROTOCOL_LABELS: Record<Protocol, string> = {
  'openai-chat': 'OpenAI Chat',
  'openai-responses': 'OpenAI Responses',
  'anthropic-messages': 'Anthropic Messages',
  gemini: 'Gemini API',
  'openai-images': 'OpenAI Images',
};

const CONTEXT_MIN: Record<ContextFilter, number> = { all: 0, '200k': 200_000, '1m': 1_000_000 };

export interface ModelFilter {
  type: TypeFilter;
  /** 空数组表示不限厂商 */
  providers: readonly ProviderId[];
  /** 空数组表示不限协议 */
  protocols: readonly Protocol[];
  context: ContextFilter;
  query: string;
  sort: SortKey;
}

export const DEFAULT_FILTER: ModelFilter = {
  type: 'all',
  providers: [],
  protocols: [],
  context: 'all',
  query: '',
  sort: 'latest',
};

function matchesQuery(model: Model, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // 名称、调用名、厂商和中英文描述都参与匹配（例如搜 nano 能找到 Nano Banana 系列）
  return [
    model.name,
    model.id,
    getProvider(model.provider).name,
    model.description.zh,
    model.description.en,
  ].some((s) => s.toLowerCase().includes(q));
}

const byName = (a: Model, b: Model) => a.name.localeCompare(b.name, 'en');
const typeOrder = (m: Model) => (m.type === 'text' ? 0 : 1);

/** 模型页的筛选与排序。价格排序时文本在前、生图在后，各自按价格排。 */
export function filterModels(
  models: readonly Model[],
  filter: ModelFilter,
  edition: EditionId,
): Model[] {
  const min = CONTEXT_MIN[filter.context];
  const result = models.filter(
    (m) =>
      (filter.type === 'all' || m.type === filter.type) &&
      (filter.providers.length === 0 || filter.providers.includes(m.provider)) &&
      (filter.protocols.length === 0 || m.protocols.some((p) => filter.protocols.includes(p))) &&
      (min === 0 || (m.contextTokens !== null && m.contextTokens >= min)) &&
      matchesQuery(m, filter.query),
  );

  const sorted = [...result];
  switch (filter.sort) {
    case 'latest':
      sorted.sort((a, b) => b.released.localeCompare(a.released) || byName(a, b));
      break;
    case 'price-asc':
    case 'price-desc': {
      const dir = filter.sort === 'price-asc' ? 1 : -1;
      sorted.sort(
        (a, b) =>
          typeOrder(a) - typeOrder(b) ||
          dir * (priceSortKey(a, edition) - priceSortKey(b, edition)) ||
          byName(a, b),
      );
      break;
    }
    case 'context':
      sorted.sort((a, b) => (b.contextTokens ?? -1) - (a.contextTokens ?? -1) || byName(a, b));
      break;
  }
  return sorted;
}

export interface FacetCounts {
  types: Record<TypeFilter, number>;
  providers: Record<ProviderId, number>;
  protocols: Record<Protocol, number>;
}

/** 筛选栏上的数量：类型按全部模型数；厂商与协议只按当前类型数，不受其他条件影响 */
export function facetCounts(models: readonly Model[], type: TypeFilter): FacetCounts {
  const inType = models.filter((m) => type === 'all' || m.type === type);
  const providers = Object.fromEntries(PROVIDERS.map((p) => [p.id, 0])) as Record<
    ProviderId,
    number
  >;
  const protocols = Object.fromEntries(PROTOCOLS.map((p) => [p, 0])) as Record<Protocol, number>;
  for (const m of inType) {
    providers[m.provider] += 1;
    for (const p of m.protocols) protocols[p] += 1;
  }
  return {
    types: {
      all: models.length,
      text: models.filter((m) => m.type === 'text').length,
      image: models.filter((m) => m.type === 'image').length,
    },
    providers,
    protocols,
  };
}

/** 价目表按厂商分段：只返回有模型的厂商，顺序同 PROVIDERS */
export function groupByProvider(
  models: readonly Model[],
): { provider: ProviderId; models: Model[] }[] {
  return PROVIDERS.map((p) => ({
    provider: p.id,
    models: models.filter((m) => m.provider === p.id),
  })).filter((g) => g.models.length > 0);
}
