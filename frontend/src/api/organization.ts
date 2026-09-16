import { apiClient } from './client'
import type {
  OrganizationInvitation,
  OrganizationMember,
  OrganizationQuotaRequest,
  OrganizationQuotaRequestPolicy,
  OrganizationSummary,
  PaginatedResponse
} from '@/types'

// start_at 缺省时由服务端取当前时刻。
export interface PeriodicQuotaPayload {
  amount: number
  period_days: number
  start_at?: string
}

export async function getCurrentOrganization(): Promise<OrganizationSummary | null> {
  const { data } = await apiClient.get<OrganizationSummary | null>('/organization')
  return data
}

export async function listOrganizationInvitations(): Promise<OrganizationInvitation[]> {
  const { data } = await apiClient.get<OrganizationInvitation[]>('/organization/invitations')
  return data
}

export async function createOrganizationInvitation(expiresAt?: string): Promise<OrganizationInvitation> {
  const { data } = await apiClient.post<OrganizationInvitation>('/organization/invitations', {
    expires_at: expiresAt || undefined
  })
  return data
}

export async function disableOrganizationInvitation(id: number): Promise<void> {
  await apiClient.delete(`/organization/invitations/${id}`)
}

export async function listOrganizationMembers(params: {
  page: number
  page_size: number
  search?: string
  status?: string
}): Promise<PaginatedResponse<OrganizationMember>> {
  const { data } = await apiClient.get<PaginatedResponse<OrganizationMember>>(
    '/organization/members',
    {
      params: {
        page: params.page,
        page_size: params.page_size,
        search: params.search || undefined,
        status: params.status || undefined
      }
    }
  )
  return data
}

export async function updateOrganizationMemberStatus(
  userId: number,
  status: 'active' | 'disabled'
): Promise<OrganizationMember> {
  const { data } = await apiClient.put<OrganizationMember>(
    `/organization/members/${userId}/status`,
    { status }
  )
  return data
}

// spendingLimit 传 null 表示改为不限额，传 0 表示完全不能消费。
export async function updateOrganizationMemberSpendingLimit(
  userId: number,
  spendingLimit: number | null
): Promise<OrganizationMember> {
  const { data } = await apiClient.put<OrganizationMember>(
    `/organization/members/${userId}/spending-limit`,
    { spending_limit: spendingLimit }
  )
  return data
}

export async function splitOrganizationMemberSpendingLimit(
  userIds: number[],
  totalAmount: number
): Promise<OrganizationMember[]> {
  const { data } = await apiClient.post<OrganizationMember[]>(
    '/organization/members/spending-limit-split',
    { user_ids: userIds, total_amount: totalAmount }
  )
  return data
}

// quota 传 null 表示取消周期、回到静态模式。
export async function updateOrganizationMemberQuota(
  userId: number,
  quota: PeriodicQuotaPayload | null
): Promise<OrganizationMember> {
  const { data } = await apiClient.put<OrganizationMember>(
    `/organization/members/${userId}/quota`,
    { quota }
  )
  return data
}

// 给选中的成员统一发同一份周期配额；quota 传 null 表示整批取消周期。
export async function batchSetOrganizationMemberQuota(
  userIds: number[],
  quota: PeriodicQuotaPayload | null
): Promise<OrganizationMember[]> {
  const { data } = await apiClient.post<OrganizationMember[]>(
    '/organization/members/quota-batch',
    { user_ids: userIds, quota }
  )
  return data
}

export async function getQuotaRequestPolicy(): Promise<OrganizationQuotaRequestPolicy> {
  const { data } = await apiClient.get<OrganizationQuotaRequestPolicy>(
    '/organization/quota-request-policy'
  )
  return data
}

// mode 不是 off 时 minAmount / maxAmount 必填。
export async function updateQuotaRequestPolicy(
  mode: OrganizationQuotaRequestPolicy['mode'],
  minAmount: number | null,
  maxAmount: number | null
): Promise<OrganizationQuotaRequestPolicy> {
  const { data } = await apiClient.put<OrganizationQuotaRequestPolicy>(
    '/organization/quota-request-policy',
    { mode, min_amount: minAmount, max_amount: maxAmount }
  )
  return data
}

// 组织创建者看本组织申请，普通成员只看自己的；服务端按身份分流。
export async function listQuotaRequests(params: {
  page: number
  page_size: number
  status?: string
}): Promise<PaginatedResponse<OrganizationQuotaRequest>> {
  const { data } = await apiClient.get<PaginatedResponse<OrganizationQuotaRequest>>(
    '/organization/quota-requests',
    {
      params: {
        page: params.page,
        page_size: params.page_size,
        status: params.status || undefined
      }
    }
  )
  return data
}

export async function submitQuotaRequest(amount: number, reason?: string): Promise<OrganizationQuotaRequest> {
  const { data } = await apiClient.post<OrganizationQuotaRequest>('/organization/quota-requests', {
    amount,
    reason: reason || undefined
  })
  return data
}

export async function withdrawQuotaRequest(id: number): Promise<OrganizationQuotaRequest> {
  const { data } = await apiClient.post<OrganizationQuotaRequest>(
    `/organization/quota-requests/${id}/withdraw`
  )
  return data
}

export async function approveQuotaRequest(id: number, note?: string): Promise<OrganizationQuotaRequest> {
  const { data } = await apiClient.post<OrganizationQuotaRequest>(
    `/organization/quota-requests/${id}/approve`,
    { note: note || undefined }
  )
  return data
}

export async function rejectQuotaRequest(id: number, note?: string): Promise<OrganizationQuotaRequest> {
  const { data } = await apiClient.post<OrganizationQuotaRequest>(
    `/organization/quota-requests/${id}/reject`,
    { note: note || undefined }
  )
  return data
}

export default {
  getCurrentOrganization,
  listOrganizationInvitations,
  createOrganizationInvitation,
  disableOrganizationInvitation,
  listOrganizationMembers,
  updateOrganizationMemberStatus,
  updateOrganizationMemberSpendingLimit,
  splitOrganizationMemberSpendingLimit,
  updateOrganizationMemberQuota,
  batchSetOrganizationMemberQuota,
  getQuotaRequestPolicy,
  updateQuotaRequestPolicy,
  listQuotaRequests,
  submitQuotaRequest,
  withdrawQuotaRequest,
  approveQuotaRequest,
  rejectQuotaRequest
}
