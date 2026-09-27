/**
 * 配额申请接口调用（只发请求 + 走适配层，不含 UI 状态）。
 *
 * 契约来源：src/features/organization/types.ts（主控冻结）与
 * ../.fleet/briefs/m45-quota-requests-api.md。
 *
 * 边界：
 * - 全部请求走注入的 ApiRequester（统一 Bearer 与 /api/portal 前缀），
 *   本模块不直接使用 fetch，不打印请求体或令牌。
 * - 只调用固定路径：/organization/quota-request-policy、/organization/quota-requests、
 *   /organization/quota-requests/:id/withdraw、.../approve、.../reject、
 *   以及只读的 /usage/dashboard/stats。
 * - 申请策略是 ownerOnly：普通成员只通过 /usage/dashboard/stats 的 organization_quota
 *   了解申请方式，不调用 policy 接口。
 * - 写操作不自动重试；审批失败（例如后端已把申请作废并返回 MEMBER_INELIGIBLE）
 *   照常抛给 UI，由 UI 在 finally 刷新权威状态，不吞错误也不伪造成功。
 */

import type { ApiRequester } from '../auth/types';
import type { PageResult } from '../keys/types';
import {
  parseMemberQuota,
  parseQuotaRequest,
  parseQuotaRequestPage,
  parseRequestPolicy,
} from './request-adapter';
import {
  assertRequestId,
  buildPolicyPayload,
  buildQuotaRequestPayload,
  reviewNote,
} from './request-validation';
import type {
  MemberQuotaInfo,
  PolicyDraft,
  QuotaRequestPolicy,
  QuotaRequestRecord,
  RequestFilters,
} from './types';

const POLICY_PATH = '/organization/quota-request-policy';
const REQUESTS_PATH = '/organization/quota-requests';
const DASHBOARD_STATS_PATH = '/usage/dashboard/stats';

function getOptions(signal?: AbortSignal): { method: 'GET'; signal?: AbortSignal } {
  return signal === undefined ? { method: 'GET' } : { method: 'GET', signal };
}

/** 申请列表查询串：page/page_size 固定，status 可选且只认已冻结枚举。 */
function requestListQuery(filters: RequestFilters): string {
  const params = new URLSearchParams();
  params.set('page', String(filters.page));
  params.set('page_size', String(filters.pageSize));
  const status = filters.status;
  if (
    status === 'pending' ||
    status === 'granted' ||
    status === 'rejected' ||
    status === 'withdrawn'
  ) {
    params.set('status', status);
  }
  return params.toString();
}

/** 读取本组织的申请策略；仅组织所有者可调用。 */
export async function fetchRequestPolicy(
  request: ApiRequester,
  signal?: AbortSignal,
): Promise<QuotaRequestPolicy> {
  const value = await request<unknown>(POLICY_PATH, getOptions(signal));
  return parseRequestPolicy(value);
}

/** 保存申请策略，返回后端确认后的权威策略。写操作不重试。 */
export async function saveRequestPolicy(
  request: ApiRequester,
  draft: PolicyDraft,
): Promise<QuotaRequestPolicy> {
  const body = buildPolicyPayload(draft);
  const value = await request<unknown>(POLICY_PATH, { method: 'PUT', body });
  return parseRequestPolicy(value);
}

/** 申请分页：所有者看本组织全部，普通成员只看自己。 */
export async function fetchQuotaRequests(
  request: ApiRequester,
  filters: RequestFilters,
  signal?: AbortSignal,
): Promise<PageResult<QuotaRequestRecord>> {
  const value = await request<unknown>(
    `${REQUESTS_PATH}?${requestListQuery(filters)}`,
    getOptions(signal),
  );
  return parseQuotaRequestPage(value);
}

/**
 * 提交一笔配额申请。
 * auto 模式下后端会直接返回 status=granted；approve 模式返回 pending。
 * 前端不根据本地模式推断结果，只以返回的记录为准。
 */
export async function submitQuotaRequest(
  request: ApiRequester,
  input: { amount: string; reason: string },
  quota?: MemberQuotaInfo,
): Promise<QuotaRequestRecord> {
  const body = buildQuotaRequestPayload(input, quota);
  const value = await request<unknown>(REQUESTS_PATH, { method: 'POST', body });
  return parseQuotaRequest(value);
}

/** 撤回本人一笔待处理申请。写操作不重试。 */
export async function withdrawQuotaRequest(
  request: ApiRequester,
  id: number,
): Promise<QuotaRequestRecord> {
  const requestId = assertRequestId(id);
  const value = await request<unknown>(`${REQUESTS_PATH}/${requestId}/withdraw`, {
    method: 'POST',
  });
  return parseQuotaRequest(value);
}

/**
 * 审批一笔待处理申请：action 决定 approve / reject，备注先 trim 到 500 码点以内。
 * 后端同意时可能因成员已不符合资格而先作废申请并返回错误，
 * 这里照常抛出，调用方需在 finally 刷新申请与成员。
 */
export async function reviewQuotaRequest(
  request: ApiRequester,
  id: number,
  action: 'approve' | 'reject',
  note: string,
): Promise<QuotaRequestRecord> {
  const requestId = assertRequestId(id);
  if (action !== 'approve' && action !== 'reject') {
    throw new Error('审批操作不正确');
  }
  const body = { note: reviewNote(note) };
  const value = await request<unknown>(`${REQUESTS_PATH}/${requestId}/${action}`, {
    method: 'POST',
    body,
  });
  return parseQuotaRequest(value);
}

/**
 * 普通成员读取自己的配额概况：只取 /usage/dashboard/stats 的 organization_quota，
 * 不调用 ownerOnly 的策略接口。字段缺失或非法由适配层抛错，不猜「不限」或 false。
 */
export async function fetchMemberQuota(
  request: ApiRequester,
  signal?: AbortSignal,
): Promise<MemberQuotaInfo> {
  const value = await request<unknown>(DASHBOARD_STATS_PATH, getOptions(signal));
  return parseMemberQuota(value);
}
