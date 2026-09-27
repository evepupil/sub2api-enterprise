/**
 * M4 组织用量数据请求层。
 *
 * 契约来源：src/features/organization-usage/types.ts、
 * docs/模块设计/组织用量.md 与设计交付契约。
 *
 * 边界：
 * - 只通过 auth/types 的 ApiRequester 发请求，不直接接触 fetch 或令牌。
 * - 所有组织查询显式带 scope=organization；筛选具体成员只用 member_user_id，
 *   绝不复用个人接口的 user_id 语义。
 * - 日期范围、时区与粒度全部来自调用方传入的 filters.range / granularity，
 *   同一概览的多个请求共用同一组参数，不同日期范围的响应不混用。
 * - 概览只用 /usage/stats 与 /usage/dashboard/snapshot-v2，成员分布用
 *   /usage/organization/members；累计统计接口 /usage/dashboard/stats 不作为
 *   组织区间统计来源。
 * - 复用个人统计已经过真实后端验证的 parseUsageOverview 与
 *   parseOrganizationRecords（内部复用 parseUsageRecords），不重复实现解析。
 */
import type { ApiRequester } from '../auth/types';
import type { PageResult } from '../keys/types';
import { parseUsageOverview } from '../usage/adapter';
import type { DateRange, TrendGranularity } from '../usage/types';
import { parseMemberUsage, parseOrganizationRecords } from './adapter';
import type {
  OrganizationUsageFilters,
  OrganizationUsageOverview,
  OrganizationUsageRecord,
  OrganizationUsageRecordFilters,
} from './types';

/** 组织统计只按日期查询，粒度只有 day / hour 两种。 */
function assertGranularity(value: TrendGranularity): TrendGranularity {
  if (value !== 'day' && value !== 'hour') {
    throw new Error(`组织用量粒度不合法：${String(value)}`);
  }
  return value;
}

/** 成员筛选：必须是正的安全整数，否则拒绝，不用字符串或越界数字凑合。 */
function assertMemberId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`组织用量成员标识不合法：${String(value)}`);
  }
  return value;
}

/** 概览、成员分布与明细共用的日期范围参数（顺序固定，便于缓存与调试）。 */
function rangeParams(range: DateRange): URLSearchParams {
  const params = new URLSearchParams();
  params.set('scope', 'organization');
  params.set('start_date', range.start);
  params.set('end_date', range.end);
  params.set('timezone', range.timeZone);
  return params;
}

function requestOptions(signal?: AbortSignal) {
  return signal === undefined ? { method: 'GET' as const } : { method: 'GET' as const, signal };
}

/**
 * 并行取同一日期范围、同一成员筛选下的组织区间汇总与图表快照，外加全组织成员分布：
 * - GET /usage/stats：请求/Token/金额/平均耗时与接口分布；
 * - GET /usage/dashboard/snapshot-v2：趋势、模型分布与分组分布；
 * - GET /usage/organization/members：按成员的用量分布（后端固定全组织，
 *   因此不带 member_user_id）。
 * 任一失败即整体失败，成功时合并为 OrganizationUsageOverview。
 */
export async function fetchOrganizationOverview(
  request: ApiRequester,
  filters: OrganizationUsageFilters,
  signal?: AbortSignal,
): Promise<OrganizationUsageOverview> {
  const granularity = assertGranularity(filters.granularity);
  const memberId = filters.memberId === undefined ? null : assertMemberId(filters.memberId);

  const params = rangeParams(filters.range);
  params.set('granularity', granularity);
  const statsParams = new URLSearchParams(params);
  const snapshotParams = new URLSearchParams(params);
  snapshotParams.set('include_trend', 'true');
  snapshotParams.set('include_model_stats', 'true');
  snapshotParams.set('include_group_stats', 'true');
  if (memberId !== null) {
    statsParams.set('member_user_id', String(memberId));
    snapshotParams.set('member_user_id', String(memberId));
  }

  const membersParams = rangeParams(filters.range);

  const options = requestOptions(signal);
  const [stats, snapshot, members] = await Promise.all([
    request<unknown>(`/usage/stats?${statsParams.toString()}`, options),
    request<unknown>(`/usage/dashboard/snapshot-v2?${snapshotParams.toString()}`, options),
    request<unknown>(`/usage/organization/members?${membersParams.toString()}`, options),
  ]);

  return {
    overview: parseUsageOverview(stats, snapshot),
    members: parseMemberUsage(members),
  };
}

/**
 * 取指定日期范围、指定成员的组织调用明细。
 * 只带上 scope=organization、可选 member_user_id、日期范围、时区、分页与模型筛选；
 * 返回的 userLabel 只来自成员展示名 / 用户名 / 邮箱，绝不携带密钥本身或用户余额。
 */
export async function fetchOrganizationRecords(
  request: ApiRequester,
  filters: OrganizationUsageRecordFilters,
  signal?: AbortSignal,
): Promise<PageResult<OrganizationUsageRecord>> {
  const memberId = filters.memberId === undefined ? null : assertMemberId(filters.memberId);

  const params = rangeParams(filters.range);
  if (memberId !== null) {
    params.set('member_user_id', String(memberId));
  }
  params.set('page', String(filters.page));
  params.set('page_size', String(filters.pageSize));
  if (filters.model !== undefined && filters.model !== '') {
    params.set('model', filters.model);
  }

  const payload = await request<unknown>(`/usage?${params.toString()}`, requestOptions(signal));
  return parseOrganizationRecords(payload);
}
