import { apiClient } from './client'
import type { OrganizationInvitation, OrganizationSummary } from '@/types'

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

export default {
  getCurrentOrganization,
  listOrganizationInvitations,
  createOrganizationInvitation
}
