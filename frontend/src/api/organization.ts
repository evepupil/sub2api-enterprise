import { apiClient } from './client'
import type {
  OrganizationInvitation,
  OrganizationMember,
  OrganizationSummary,
  PaginatedResponse
} from '@/types'

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

export default {
  getCurrentOrganization,
  listOrganizationInvitations,
  createOrganizationInvitation,
  listOrganizationMembers,
  updateOrganizationMemberStatus,
  updateOrganizationMemberSpendingLimit,
  splitOrganizationMemberSpendingLimit
}
