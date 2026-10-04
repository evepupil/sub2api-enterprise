'use client';

import { getPortalJson, redirectToLogin, type FetchResult } from './loadable';
import type { LogFilters, LogOptions, LogQuery, LogsPageData } from './logs-types';

/**
 * 浏览器端取日志页的数据（官网接口 /api/portal/console/logs*），取数工具见 ./loadable。
 */

/** 筛选条件 → 官网接口的查询参数 */
export function filterParams(filters: LogFilters): URLSearchParams {
  const params = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.keyId !== null) params.set('key', String(filters.keyId));
  if (filters.model !== null) params.set('model', filters.model);
  if (filters.type !== 'all') params.set('type', filters.type);
  if (filters.stream !== 'all') params.set('stream', filters.stream);
  return params;
}

/** 一页日志 */
export function fetchLogs(
  query: LogQuery,
  signal?: AbortSignal,
): Promise<FetchResult<LogsPageData>> {
  const params = filterParams(query);
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return getPortalJson(
    `/api/portal/console/logs?${params.toString()}`,
    (body) =>
      Array.isArray(body.items) && typeof body.total === 'number'
        ? {
            items: body.items as LogsPageData['items'],
            total: body.total,
            page: typeof body.page === 'number' ? body.page : query.page,
            pageSize: typeof body.pageSize === 'number' ? body.pageSize : query.pageSize,
          }
        : null,
    signal,
  );
}

/** 筛选下拉的选项（密钥、这段时间用过的模型） */
export function fetchLogOptions(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<FetchResult<LogOptions>> {
  return getPortalJson(
    `/api/portal/console/logs/options?${new URLSearchParams({ from, to }).toString()}`,
    (body) =>
      Array.isArray(body.keys) && Array.isArray(body.models)
        ? { keys: body.keys as LogOptions['keys'], models: body.models as string[] }
        : null,
    signal,
  );
}

/** 导出 CSV：官网服务器拼好文件，这里存成下载。成功返回 true；登录失效时跳登录页 */
export async function downloadLogsCsv(filters: LogFilters, locale: string): Promise<boolean> {
  const params = filterParams(filters);
  params.set('locale', locale);
  try {
    const response = await fetch(`/api/portal/console/logs/export?${params.toString()}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (response.status === 401) {
      redirectToLogin();
      return false;
    }
    if (!response.ok) return false;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-${filters.from}-${filters.to}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    // 下载已经交给浏览器，稍等再释放临时地址，个别浏览器点击后立刻释放会丢掉下载
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
