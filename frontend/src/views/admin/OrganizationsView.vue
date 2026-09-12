<template>
  <AppLayout>
    <div class="space-y-6">
      <section class="card overflow-hidden">
        <div
          class="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-dark-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('admin.organizations.title') }}
          </h1>
          <SearchInput
            v-model="search"
            class="sm:w-64"
            :placeholder="t('admin.organizations.searchPlaceholder')"
            @search="applyFilters"
          />
        </div>

        <div v-if="loading" class="flex justify-center py-16">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
        </div>

        <div
          v-else-if="organizations.length === 0"
          class="px-5 py-16 text-center text-sm text-gray-500 dark:text-dark-400"
        >
          {{ t('admin.organizations.empty') }}
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-gray-500 dark:border-dark-700 dark:text-dark-400">
                <th class="px-4 py-2 font-medium">{{ t('admin.organizations.name') }}</th>
                <th class="px-4 py-2 font-medium">{{ t('admin.organizations.owner') }}</th>
                <th class="px-4 py-2 text-right font-medium">{{ t('admin.organizations.memberCount') }}</th>
                <th class="px-4 py-2 font-medium">{{ t('common.status') }}</th>
                <th class="px-4 py-2 font-medium">{{ t('admin.organizations.groupScope') }}</th>
                <th class="px-4 py-2 font-medium">{{ t('admin.organizations.createdAt') }}</th>
                <th class="px-4 py-2 text-right font-medium">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="organization in organizations"
                :key="organization.id"
                class="border-b border-gray-100 last:border-b-0 dark:border-dark-800"
              >
                <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ organization.name }}</td>
                <td class="px-4 py-3">
                  <div class="text-gray-900 dark:text-white">{{ organization.owner_email }}</div>
                  <div v-if="organization.owner_username" class="text-xs text-gray-500 dark:text-dark-400">
                    {{ organization.owner_username }}
                  </div>
                </td>
                <td class="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                  {{ organization.member_count }}
                </td>
                <td class="px-4 py-3">
                  <span
                    class="rounded-full px-2.5 py-1 text-xs font-medium"
                    :class="
                      organization.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    "
                  >
                    {{ organization.status === 'active' ? t('common.enabled') : t('common.disabled') }}
                  </span>
                </td>
                <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {{ describeScope(organization) }}
                </td>
                <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {{ formatDateTime(organization.created_at) }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <RouterLink
                      class="btn btn-secondary btn-sm"
                      :to="{ path: '/admin/users', query: { organization_id: organization.id } }"
                    >
                      {{ t('admin.organizations.viewMembers') }}
                    </RouterLink>
                    <button type="button" class="btn btn-secondary btn-sm" @click="openScopeDialog(organization)">
                      {{ t('admin.organizations.configureGroups') }}
                    </button>
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      :disabled="statusUpdatingId === organization.id"
                      @click="toggleStatus(organization)"
                    >
                      {{ organization.status === 'active' ? t('admin.organizations.disable') : t('admin.organizations.enable') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Pagination
          v-if="total > 0"
          :total="total"
          :page="page"
          :page-size="pageSize"
          @update:page="handlePageChange"
          @update:pageSize="handlePageSizeChange"
        />
      </section>
    </div>

    <BaseDialog
      :show="scopeDialog.show"
      :title="t('admin.organizations.configureGroups')"
      @close="closeScopeDialog"
    >
      <div class="space-y-4">
        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ scopeDialog.name }}</p>

        <label class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            v-model="scopeDialog.restrictPublicGroups"
            type="checkbox"
            class="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>{{ t('admin.organizations.restrictPublicGroups') }}</span>
        </label>

        <div v-if="groupsLoading" class="flex justify-center py-8">
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
        </div>
        <ul v-else class="max-h-72 space-y-1 overflow-y-auto">
          <li v-for="group in groups" :key="group.id">
            <label class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-dark-800">
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                :checked="scopeDialog.allowedGroupIds.includes(group.id)"
                @change="toggleGroup(group.id)"
              />
              <span class="text-gray-900 dark:text-white">{{ group.name }}</span>
              <span
                v-if="group.is_exclusive"
                class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              >
                {{ t('admin.organizations.exclusive') }}
              </span>
            </label>
          </li>
        </ul>

        <p v-if="scopeDialog.error" class="text-sm text-red-600 dark:text-red-400">{{ scopeDialog.error }}</p>
      </div>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="closeScopeDialog">{{ t('common.cancel') }}</button>
        <button type="button" class="btn btn-primary" :disabled="scopeDialog.saving" @click="saveScope">
          {{ t('common.save') }}
        </button>
      </template>
    </BaseDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Pagination from '@/components/common/Pagination.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import adminAPI from '@/api/admin'
import type { AdminOrganization, Group } from '@/types'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()
const appStore = useAppStore()

const organizations = ref<AdminOrganization[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const search = ref('')
const loading = ref(true)

const statusUpdatingId = ref<number | null>(null)
const groups = ref<Group[]>([])
const groupsLoading = ref(false)

const scopeDialog = reactive({
  show: false,
  organizationId: 0,
  name: '',
  restrictPublicGroups: false,
  allowedGroupIds: [] as number[],
  error: '',
  saving: false
})

// 分组范围一句话概括：不限制公开分组时只需说明额外授权了几个分组。
function describeScope(organization: AdminOrganization): string {
  if (organization.restrict_public_groups) {
    return t('admin.organizations.scopeRestricted', { count: organization.allowed_group_ids.length })
  }
  return t('admin.organizations.scopeOpen', { count: organization.allowed_group_ids.length })
}

async function loadOrganizations(): Promise<void> {
  loading.value = true
  try {
    const result = await adminAPI.organizations.list(page.value, pageSize.value, {
      search: search.value.trim() || undefined
    })
    organizations.value = result.items || []
    total.value = result.total
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('admin.organizations.loadFailed')))
  } finally {
    loading.value = false
  }
}

async function loadGroups(): Promise<void> {
  if (groups.value.length > 0) return
  groupsLoading.value = true
  try {
    const result = await adminAPI.groups.list(1, 200, { status: 'active' })
    groups.value = result.items || []
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('admin.organizations.loadGroupsFailed')))
  } finally {
    groupsLoading.value = false
  }
}

function applyFilters(): void {
  page.value = 1
  void loadOrganizations()
}

function handlePageChange(value: number): void {
  page.value = value
  void loadOrganizations()
}

function handlePageSizeChange(value: number): void {
  pageSize.value = value
  page.value = 1
  void loadOrganizations()
}

// 停用只作用在组织这一层：成员账号状态不动，恢复后原本被单独停用的成员仍然是停用的。
async function toggleStatus(organization: AdminOrganization): Promise<void> {
  statusUpdatingId.value = organization.id
  try {
    const updated = await adminAPI.organizations.updateStatus(
      organization.id,
      organization.status === 'active' ? 'disabled' : 'active'
    )
    const index = organizations.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) {
      organizations.value.splice(index, 1, updated)
    }
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('admin.organizations.statusFailed')))
  } finally {
    statusUpdatingId.value = null
  }
}

function openScopeDialog(organization: AdminOrganization): void {
  scopeDialog.show = true
  scopeDialog.organizationId = organization.id
  scopeDialog.name = organization.name
  scopeDialog.restrictPublicGroups = organization.restrict_public_groups
  scopeDialog.allowedGroupIds = [...organization.allowed_group_ids]
  scopeDialog.error = ''
  void loadGroups()
}

function closeScopeDialog(): void {
  scopeDialog.show = false
}

function toggleGroup(groupId: number): void {
  const index = scopeDialog.allowedGroupIds.indexOf(groupId)
  if (index >= 0) {
    scopeDialog.allowedGroupIds.splice(index, 1)
    return
  }
  scopeDialog.allowedGroupIds.push(groupId)
}

async function saveScope(): Promise<void> {
  scopeDialog.saving = true
  scopeDialog.error = ''
  try {
    const updated = await adminAPI.organizations.updateGroups(
      scopeDialog.organizationId,
      scopeDialog.restrictPublicGroups,
      [...scopeDialog.allowedGroupIds]
    )
    const index = organizations.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) {
      organizations.value.splice(index, 1, updated)
    }
    scopeDialog.show = false
  } catch (error) {
    scopeDialog.error = extractApiErrorMessage(error, t('admin.organizations.saveFailed'))
  } finally {
    scopeDialog.saving = false
  }
}

onMounted(() => {
  void loadOrganizations()
})
</script>
