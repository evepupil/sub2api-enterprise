/**
 * M3 用量数据请求层。
 *
 * 契约来源：src/features/usage/types.ts、src/features/usage/adapter.ts 与
 * docs/模块设计/用量统计.md。
 *
 * 边界：
 * - 只通过 auth/types 的 ApiRequester 发请求，不直接接触 fetch 或令牌。
 * - 日期范围、时区与粒度由调用方显式传入，同一概览的两个请求共用同一组参数；
 *   不同日期范围的响应不混用。
 * - 错误数据交给适配器抛异常，由 UI 显示，不在这里伪造零值。
 */
import type { ApiRequester, PortalUser } from '../auth/types';
import type { PageResult } from '../keys/types';
import {
  parseBalanceFunds,
  parseQuotaFunds,
  parseUsageOverview,
  parseUsageRecords,
} from './adapter';
import type {
  CurrentFunds,
  DateRange,
  TrendGranularity,
  UsageFilters,
  UsageOverview,
  UsageRecord,
} from './types';

/** 概览、明细与配额查询共用的日期范围参数（顺序固定，便于缓存与调试）。 */
function rangeParams(range: DateRange, granularity?: TrendGranularity): URLSearchParams {
  const params = new URLSearchParams();
  params.set('start_date', range.start);
  params.set('end_date', range.end);
  params.set('timezone', range.timeZone);
  if (granularity !== undefined) {
    params.set('granularity', granularity);
  }
  return params;
}

/**
 * 并行取同一日期范围的区间汇总与图表快照：
 * - GET /usage/stats：请求/Token/金额/平均耗时与接口分布；
 * - GET /usage/dashboard/snapshot-v2：趋势、模型分布与分组分布。
 * 任一失败即整体失败，成功时合并为 UsageOverview。
 */
export async function fetchUsageOverview(
  request: ApiRequester,
  range: DateRange,
  granularity: TrendGranularity,
  signal?: AbortSignal,
): Promise<UsageOverview> {
  const params = rangeParams(range, granularity);
  const snapshotParams = new URLSearchParams(params);
  snapshotParams.set('include_trend', 'true');
  snapshotParams.set('include_model_stats', 'true');
  snapshotParams.set('include_group_stats', 'true');

  const options =
    signal === undefined ? { method: 'GET' as const } : { method: 'GET' as const, signal };

  const [stats, snapshot] = await Promise.all([
    request<unknown>(`/usage/stats?${params.toString()}`, options),
    request<unknown>(`/usage/dashboard/snapshot-v2?${snapshotParams.toString()}`, options),
  ]);

  return parseUsageOverview(stats, snapshot);
}

/**
 * 取指定日期范围的调用明细。
 * 只带上页面/页大小、日期范围、时区与可选模型、密钥筛选；
 * 返回的 keyName 只来自 api_key.name，绝不携带密钥本身。
 */
export async function fetchUsageRecords(
  request: ApiRequester,
  filters: UsageFilters,
  signal?: AbortSignal,
): Promise<PageResult<UsageRecord>> {
  const params = rangeParams(filters.range);
  params.set('page', String(filters.page));
  params.set('page_size', String(filters.pageSize));
  if (filters.model !== undefined && filters.model !== '') {
    params.set('model', filters.model);
  }
  if (filters.keyId !== undefined) {
    params.set('api_key_id', String(filters.keyId));
  }

  const options =
    signal === undefined ? { method: 'GET' as const } : { method: 'GET' as const, signal };
  const payload = await request<unknown>(`/usage?${params.toString()}`, options);
  return parseUsageRecords(payload);
}

/**
 * 取当前资金：
 * - 普通组织成员（属于组织且不是创建者）只看 /usage/dashboard/stats 的 organization_quota；
 * - 其余角色走 /user/profile 的当前 balance / frozen_balance。
 * 组织配额缺失或非法时抛安全错误，不猜余额、不把配额当 0；
 * 累计统计不参与区间概览，反之亦然。
 */
export async function fetchCurrentFunds(
  request: ApiRequester,
  user: PortalUser,
  signal?: AbortSignal,
): Promise<CurrentFunds> {
  const options =
    signal === undefined ? { method: 'GET' as const } : { method: 'GET' as const, signal };
  const isPlainMember = user.organization !== null && !user.organization.isOwner;

  if (isPlainMember) {
    const stats = await request<unknown>('/usage/dashboard/stats', options);
    return parseQuotaFunds(stats);
  }

  const profile = await request<unknown>('/user/profile', options);
  return parseBalanceFunds(profile);
}
