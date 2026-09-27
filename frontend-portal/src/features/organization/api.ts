/**
 * 组织、成员、邀请与额度接口调用（只发请求 + 走适配层，不含 UI 状态）。
 *
 * 契约来源：src/features/organization/types.ts（主控冻结）与
 * design/team-and-delivery.md「页面 14：组织与成员」。
 *
 * 边界：
 * - 路径固定为 /organization、/organization/members、/organization/invitations，
 *   请求里不发组织编号，范围来自服务端身份。
 * - 响应先经 adapter 白名单校验，内部字段（password、api_key 等）不进页面。
 * - 写操作不自动重试；错误文案为中文且不含内部字段与堆栈。
 */

import type { ApiRequester } from '../auth/types';
import type { PageResult } from '../keys/types';
import {
  parseDefaultQuota,
  parseDefaultQuotaResult,
  parseInvitations,
  parseMember,
  parseMemberPage,
  parseOrganization,
} from './adapter';
import type {
  DefaultQuota,
  DefaultQuotaDraft,
  DefaultQuotaResult,
  MemberFilters,
  OrganizationInfo,
  OrganizationInvitation,
  OrganizationMember,
  QuotaDraft,
} from './types';
import {
  buildDefaultQuotaPayload,
  buildMemberQuotaPayload,
  parseQuotaAmount,
  validateDisplayName,
} from './validation';

/** 逐页读取全部成员时使用的页大小：后端 page_size 上限为 1000。 */
const ALL_MEMBERS_PAGE_SIZE = 200;
/** 防止后端始终返回非空分页导致无限循环的上限（200 * 500 = 10 万成员）。 */
const ALL_MEMBERS_MAX_PAGES = 500;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 路径参数：必须是正安全整数，避免把任意字符串拼进路径。 */
function memberId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('成员编号不正确');
  }
  return value;
}

/** 批量目标：去重排序，非法编号直接拒绝，不静默丢弃。 */
function memberIds(values: number[]): number[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('请至少选择一名成员');
  }
  const unique = new Set<number>();
  for (const value of values) {
    unique.add(memberId(value));
  }
  return Array.from(unique).sort((left, right) => left - right);
}

function listQuery(filters: MemberFilters): string {
  const page = Number.isSafeInteger(filters.page) && filters.page > 0 ? filters.page : 1;
  const pageSize =
    Number.isSafeInteger(filters.pageSize) && filters.pageSize > 0 ? filters.pageSize : 20;
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  const search = filters.search?.trim() ?? '';
  if (search !== '') {
    params.set('search', search);
  }
  if (filters.status === 'active' || filters.status === 'disabled') {
    params.set('status', filters.status);
  }
  return params.toString();
}

/** 个人账号没有组织时后端返回 null；适配层把 null/undefined 都归一成 null。 */
export async function fetchOrganization(
  request: ApiRequester,
  signal?: AbortSignal,
): Promise<OrganizationInfo | null> {
  const value = await request<unknown>('/organization', { method: 'GET', signal });
  return parseOrganization(value);
}

export async function fetchMembers(
  request: ApiRequester,
  filters: MemberFilters,
  signal?: AbortSignal,
): Promise<PageResult<OrganizationMember>> {
  const value = await request<unknown>(`/organization/members?${listQuery(filters)}`, {
    method: 'GET',
    signal,
  });
  return parseMemberPage(value);
}

/**
 * 逐页读取全部成员，供成员选择器使用。
 * 页大小 200，读到 total 为止；空页或 pages 用尽但 collected < total 时说明
 * 分页结果自相矛盾，抛可重试错误，绝不返回被截断的部分列表。
 */
export async function fetchAllMemberOptions(
  request: ApiRequester,
  signal?: AbortSignal,
): Promise<OrganizationMember[]> {
  const collected: OrganizationMember[] = [];
  let page = 1;
  while (page <= ALL_MEMBERS_MAX_PAGES) {
    const result = await fetchMembers(request, { page, pageSize: ALL_MEMBERS_PAGE_SIZE }, signal);
    collected.push(...result.items);
    if (collected.length >= result.total) {
      return collected;
    }
    const noMorePages = result.items.length === 0 || (result.pages > 0 && page >= result.pages);
    if (noMorePages) {
      throw new Error('成员列表读取不完整，请重试或缩小范围');
    }
    page += 1;
  }
  throw new Error('成员数量过多，未能读取完整列表，请缩小范围后重试');
}

/** 邀请码列表：后端返回裸数组，最多 100 条。 */
export async function fetchInvitations(
  request: ApiRequester,
  signal?: AbortSignal,
): Promise<OrganizationInvitation[]> {
  const value = await request<unknown>('/organization/invitations', { method: 'GET', signal });
  return parseInvitations(value);
}

export async function createInvitation(
  request: ApiRequester,
  expiresDate?: string,
): Promise<OrganizationInvitation> {
  const body: UnknownRecord = {};
  const date = expiresDate?.trim() ?? '';
  if (date !== '') {
    const timestamp = Date.parse(date);
    if (!Number.isFinite(timestamp)) {
      throw new Error('到期时间格式不正确');
    }
    body.expires_at = new Date(timestamp).toISOString();
  }
  const value = await request<unknown>('/organization/invitations', { method: 'POST', body });
  const parsed = parseInvitations([value]);
  const invitation = parsed[0];
  if (invitation === undefined) {
    throw new Error('邀请码创建结果不合法');
  }
  return invitation;
}

export async function disableInvitation(request: ApiRequester, id: number): Promise<void> {
  await request<unknown>(`/organization/invitations/${memberId(id)}`, { method: 'DELETE' });
}

export async function updateMemberName(
  request: ApiRequester,
  id: number,
  name: string,
): Promise<OrganizationMember> {
  const displayName = validateDisplayName(name);
  const value = await request<unknown>(`/organization/members/${memberId(id)}/display-name`, {
    method: 'PUT',
    body: { display_name: displayName },
  });
  return parseMember(value);
}

export async function setMemberStatus(
  request: ApiRequester,
  id: number,
  status: 'active' | 'disabled',
): Promise<OrganizationMember> {
  if (status !== 'active' && status !== 'disabled') {
    throw new Error('成员状态不正确');
  }
  const value = await request<unknown>(`/organization/members/${memberId(id)}/status`, {
    method: 'PUT',
    body: { status },
  });
  return parseMember(value);
}

/**
 * 保存单个成员额度。
 * 静态模式调用 spending-limit（退出周期并保留已消费）；
 * 周期模式调用 quota；不按 draft 里另一模式的残留字段发请求。
 */
export async function saveMemberQuota(
  request: ApiRequester,
  id: number,
  draft: QuotaDraft,
): Promise<OrganizationMember> {
  const target = memberId(id);
  const payload = buildMemberQuotaPayload(draft);
  const path =
    payload.kind === 'static'
      ? `/organization/members/${target}/spending-limit`
      : `/organization/members/${target}/quota`;
  const value = await request<unknown>(path, { method: 'PUT', body: payload.body });
  return parseMember(value);
}

/** 均分总上限：由后端精确分配到每个成员，前端不预先算份额。 */
export async function splitMemberLimits(
  request: ApiRequester,
  ids: number[],
  total: string,
): Promise<OrganizationMember[]> {
  const body = {
    user_ids: memberIds(ids),
    total_amount: parseQuotaAmount(total),
  };
  const value = await request<unknown>('/organization/members/spending-limit-split', {
    method: 'POST',
    body,
  });
  return parseMemberList(value);
}

/**
 * 批量周期额度：只支持设置周期配额或取消周期（quota: null），
 * 不冒充批量静态上限（静态批量走 splitMemberLimits 的均分）。
 */
export async function saveBatchQuota(
  request: ApiRequester,
  ids: number[],
  draft: QuotaDraft,
): Promise<OrganizationMember[]> {
  const payload = buildMemberQuotaPayload(draft);
  if (payload.kind !== 'periodic') {
    throw new Error('批量设置只支持周期额度，请改用均分总上限');
  }
  const body = { user_ids: memberIds(ids), quota: payload.body.quota };
  const value = await request<unknown>('/organization/members/quota-batch', {
    method: 'POST',
    body,
  });
  return parseMemberList(value);
}

export async function fetchDefaultQuota(
  request: ApiRequester,
  signal?: AbortSignal,
): Promise<DefaultQuota> {
  const value = await request<unknown>('/organization/default-quota', { method: 'GET', signal });
  return parseDefaultQuota(value);
}

export async function saveDefaultQuota(
  request: ApiRequester,
  draft: DefaultQuotaDraft,
): Promise<DefaultQuotaResult> {
  const value = await request<unknown>('/organization/default-quota', {
    method: 'PUT',
    body: buildDefaultQuotaPayload(draft),
  });
  return parseDefaultQuotaResult(value);
}

/** 批量写接口返回成员数组；单元素包装也接受，绝不把失败当成功。 */
function parseMemberList(value: unknown): OrganizationMember[] {
  if (Array.isArray(value)) {
    return value.map((entry, index) => parseMember(entry, index));
  }
  if (isRecord(value)) {
    return [parseMember(value)];
  }
  throw new Error('组织成员数据格式不正确');
}
