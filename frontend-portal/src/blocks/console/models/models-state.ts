import type {
  ContextFilter,
  ModelFilter,
  Protocol,
  ProviderId,
  SortKey,
  TypeFilter,
} from '@/lib/catalog';

/** 模型范围：全部模型，或只看自己收藏的 */
export type ModelScope = 'all' | 'favorites';

/**
 * 页内的筛选条件。厂商、协议在界面上是单选下拉（「全部」用 'all' 表示），
 * 而数据层要的是数组（空数组表示不限），转换集中在 toModelFilter。
 */
export interface ModelsQuery {
  type: TypeFilter;
  provider: ProviderId | 'all';
  context: ContextFilter;
  protocol: Protocol | 'all';
  query: string;
  sort: SortKey;
}

export const DEFAULT_QUERY: ModelsQuery = {
  type: 'all',
  provider: 'all',
  context: 'all',
  protocol: 'all',
  query: '',
  sort: 'latest',
};

/** 默认收藏的两个模型（占位数据） */
export const DEFAULT_FAVORITES: readonly string[] = ['claude-sonnet-5-5', 'gpt-6-sol'];

export function toModelFilter(q: ModelsQuery): ModelFilter {
  return {
    type: q.type,
    providers: q.provider === 'all' ? [] : [q.provider],
    protocols: q.protocol === 'all' ? [] : [q.protocol],
    context: q.context,
    query: q.query,
    sort: q.sort,
  };
}

/**
 * 清除筛选：类型、厂商、上下文、协议、搜索词回到默认。
 * 排序不属于筛选，保持用户选的；范围（全部 / 收藏）也不动。
 */
export function clearFilters(q: ModelsQuery): ModelsQuery {
  return { ...DEFAULT_QUERY, sort: q.sort };
}

/** 分页回第一页的依据：范围或任何筛选、排序条件变了，都从第 1 页重新看 */
export function paginationKey(scope: ModelScope, q: ModelsQuery): string {
  return [scope, q.type, q.provider, q.context, q.protocol, q.query, q.sort].join('|');
}
