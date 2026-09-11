/**
 * Admin Organizations API endpoints
 *
 * 平台管理员查看全平台组织并配置每个组织可用的分组范围。
 */

import { apiClient } from '../client'
import type { AdminOrganization, BasePaginationResponse } from '@/types'

export async function list(
  page: number = 1,
  pageSize: number = 20,
  filters?: {
    search?: string
  },
  options?: {
    signal?: AbortSignal
  }
): Promise<BasePaginationResponse<AdminOrganization>> {
  const { data } = await apiClient.get<BasePaginationResponse<AdminOrganization>>('/admin/organizations', {
    params: { page, page_size: pageSize, ...filters },
    signal: options?.signal
  })
  return data
}

export async function get(id: number): Promise<AdminOrganization> {
  const { data } = await apiClient.get<AdminOrganization>(`/admin/organizations/${id}`)
  return data
}

// restrictPublicGroups 打开后，公开分组也必须出现在 allowedGroupIds 里。
export async function updateGroups(
  id: number,
  restrictPublicGroups: boolean,
  allowedGroupIds: number[]
): Promise<AdminOrganization> {
  const { data } = await apiClient.put<AdminOrganization>(`/admin/organizations/${id}/groups`, {
    restrict_public_groups: restrictPublicGroups,
    allowed_group_ids: allowedGroupIds
  })
  return data
}

export default {
  list,
  get,
  updateGroups
}
