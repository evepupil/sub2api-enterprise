'use client';

import {
  getPortalJson,
  isRecord,
  sendPortalJson,
  type ActionResult,
  type FetchResult,
} from './loadable';
import type { InvitationValidity } from './org-rules';
import type {
  DefaultQuotaInput,
  MemberBatch,
  MemberUpdate,
  MyOrgQuota,
  OrgDefaultQuota,
  OrgErrorReason,
  OrgInvitation,
  OrgMember,
  OrgMembersPage,
  OrgMembersQuery,
  OrgSummary,
  QuotaRequest,
  QuotaRequestAction,
  QuotaRequestPolicy,
  QuotaRequestsPage,
  QuotaRequestStatusFilter,
} from './org-types';

/**
 * 浏览器端的组织数据与操作（官网接口 /api/portal/console/organization*），取数工具见 ./loadable。
 * 改动的结果是「成功 + 数据」或「失败 + 原因」；登录失效时整页跳登录页。
 */

const BASE = '/api/portal/console/organization';

/** 组织概况；不在组织里时 organization 为 null */
export function fetchOrgSummary(
  signal?: AbortSignal,
): Promise<FetchResult<{ organization: OrgSummary | null }>> {
  return getPortalJson(
    BASE,
    (body) =>
      'organization' in body ? { organization: body.organization as OrgSummary | null } : null,
    signal,
  );
}

const pageOf = <T>(body: Record<string, unknown>): T | null =>
  isRecord(body.data) && Array.isArray(body.data.items) ? (body.data as unknown as T) : null;

export function fetchMembers(
  query: OrgMembersQuery,
  signal?: AbortSignal,
): Promise<FetchResult<OrgMembersPage>> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.search) params.set('search', query.search);
  if (query.status !== 'all') params.set('status', query.status);
  return getPortalJson(`${BASE}/members?${params.toString()}`, pageOf<OrgMembersPage>, signal);
}

export function fetchInvitations(signal?: AbortSignal): Promise<FetchResult<OrgInvitation[]>> {
  return getPortalJson(
    `${BASE}/invitations`,
    (body) => (Array.isArray(body.invitations) ? (body.invitations as OrgInvitation[]) : null),
    signal,
  );
}

export function fetchDefaultQuota(signal?: AbortSignal): Promise<FetchResult<OrgDefaultQuota>> {
  return getPortalJson(
    `${BASE}/default-quota`,
    (body) =>
      isRecord(body.defaultQuota) ? (body.defaultQuota as unknown as OrgDefaultQuota) : null,
    signal,
  );
}

export function fetchPolicy(signal?: AbortSignal): Promise<FetchResult<QuotaRequestPolicy>> {
  return getPortalJson(
    `${BASE}/quota-request-policy`,
    (body) => (isRecord(body.policy) ? (body.policy as unknown as QuotaRequestPolicy) : null),
    signal,
  );
}

export function fetchQuotaRequests(
  query: { page: number; pageSize: number; status: QuotaRequestStatusFilter },
  signal?: AbortSignal,
): Promise<FetchResult<QuotaRequestsPage>> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.status !== 'all') params.set('status', query.status);
  return getPortalJson(
    `${BASE}/quota-requests?${params.toString()}`,
    pageOf<QuotaRequestsPage>,
    signal,
  );
}

/** 普通成员自己的组织配额；个人用户、组织管理员为 null */
export function fetchMyOrgQuota(
  signal?: AbortSignal,
): Promise<FetchResult<{ quota: MyOrgQuota | null }>> {
  return getPortalJson(
    `${BASE}/my-quota`,
    (body) => ('quota' in body ? { quota: body.quota as MyOrgQuota | null } : null),
    signal,
  );
}

export type OrgActionResult<T> = ActionResult<T, OrgErrorReason>;

const REASONS: readonly OrgErrorReason[] = [
  'owner_required',
  'not_in_org',
  'org_disabled',
  'member_not_found',
  'owner_immutable',
  'name_invalid',
  'amount_invalid',
  'period_invalid',
  'start_invalid',
  'no_targets',
  'request_disabled',
  'request_amount',
  'request_pending_exists',
  'request_ineligible',
  'request_handled',
  'request_not_found',
  'text_too_long',
  'range_invalid',
  'invalid',
  'forbidden',
  'too_many',
  'unavailable',
];

/** 官网接口没给认得的原因时，按状态码归类 */
function fallbackReason(status: number): OrgErrorReason {
  if (status === 400) return 'invalid';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'too_many';
  return 'unavailable';
}

function send<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body: unknown,
  accept: (payload: Record<string, unknown>) => T | null,
): Promise<OrgActionResult<T>> {
  return sendPortalJson(url, method, body, accept, REASONS, fallbackReason);
}

const field =
  <T>(name: string) =>
  (payload: Record<string, unknown>): T | null =>
    payload[name] === undefined || payload[name] === null ? null : (payload[name] as T);

export function updateMember(
  userId: number,
  update: MemberUpdate,
): Promise<OrgActionResult<OrgMember>> {
  return send(`${BASE}/members/${userId}`, 'PATCH', update, field<OrgMember>('member'));
}

export function batchMembers(batch: MemberBatch): Promise<OrgActionResult<OrgMember[]>> {
  return send(`${BASE}/members/batch`, 'POST', batch, field<OrgMember[]>('members'));
}

export function createInvitation(
  days: InvitationValidity,
): Promise<OrgActionResult<OrgInvitation>> {
  return send(`${BASE}/invitations`, 'POST', { days }, field<OrgInvitation>('invitation'));
}

export function disableInvitation(id: number): Promise<OrgActionResult<true>> {
  return send(`${BASE}/invitations/${id}`, 'DELETE', undefined, () => true);
}

export function saveDefaultQuota(
  input: DefaultQuotaInput,
): Promise<OrgActionResult<{ defaultQuota: OrgDefaultQuota; syncedUsers: number }>> {
  return send(
    `${BASE}/default-quota`,
    'PUT',
    input,
    field<{ defaultQuota: OrgDefaultQuota; syncedUsers: number }>('result'),
  );
}

export function savePolicy(
  policy: QuotaRequestPolicy,
): Promise<OrgActionResult<QuotaRequestPolicy>> {
  return send(`${BASE}/quota-request-policy`, 'PUT', policy, field<QuotaRequestPolicy>('policy'));
}

export function submitQuotaRequest(
  amount: number,
  reason: string,
): Promise<OrgActionResult<QuotaRequest>> {
  return send(`${BASE}/quota-requests`, 'POST', { amount, reason }, field<QuotaRequest>('request'));
}

export function actOnQuotaRequest(
  id: number,
  action: QuotaRequestAction,
  note = '',
): Promise<OrgActionResult<QuotaRequest>> {
  return send(
    `${BASE}/quota-requests/${id}`,
    'POST',
    { action, note },
    field<QuotaRequest>('request'),
  );
}
