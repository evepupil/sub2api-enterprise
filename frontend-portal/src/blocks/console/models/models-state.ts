import type { ModelsQuery } from '@/lib/console/live/models-view';

export type { ModelsQuery } from '@/lib/console/live/models-view';

/** 模型范围：全部模型，或只看自己收藏的 */
export type ModelScope = 'all' | 'favorites';

export const DEFAULT_QUERY: ModelsQuery = {
  type: 'all',
  provider: 'all',
  context: 'all',
  protocol: 'all',
  query: '',
  sort: 'latest',
};

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
