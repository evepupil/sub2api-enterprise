<template>
  <AppLayout>
    <div class="space-y-6">
      <section class="card overflow-hidden">
        <div
          class="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-dark-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <h1 class="text-lg font-semibold text-content-strong">
            {{ t('admin.organizations.title') }}
          </h1>
          <SearchInput
            v-model="search"
            class="sm:w-64"
            :placeholder="t('admin.organizations.searchPlaceholder')"
            @search="applyFilters"
          />
        </div>

        <DataTable
          :columns="columns"
          :data="organizations"
          :loading="loading"
          row-key="id"
        >
          <template #empty>
            <div v-if="loadError" class="empty-state">
              <p class="empty-state-title">{{ t('admin.organizations.loadFailed') }}</p>
              <button type="button" class="btn btn-secondary btn-sm mt-3" @click="loadOrganizations">
                {{ t('common.retry') }}
              </button>
            </div>
            <div v-else class="empty-state">
              <Icon name="inbox" class="empty-state-icon" />
              <p class="empty-state-title">{{ t('admin.organizations.empty') }}</p>
            </div>
          </template>
          <template #cell-name="{ row }">
            <span class="font-medium text-content-strong">{{ row.name }}</span>
          </template>
          <template #cell-owner="{ row }">
            <div class="max-w-[14rem] truncate text-content-strong" :title="row.owner_email">
              {{ row.owner_email }}
            </div>
            <div
              v-if="row.owner_username"
              class="max-w-[14rem] truncate text-xs text-content-muted"
              :title="row.owner_username"
            >
              {{ row.owner_username }}
            </div>
          </template>
          <template #cell-member_count="{ row }">
            {{ row.member_count }}
          </template>
          <template #cell-status="{ row }">
            <span
              class="rounded-full px-2.5 py-1 text-xs font-medium"
              :class="
                row.status === 'active'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              "
            >
              {{ row.status === 'active' ? t('common.enabled') : t('common.disabled') }}
            </span>
          </template>
          <template #cell-group_scope="{ row }">
            {{ describeScope(row) }}
          </template>
          <template #cell-created_at="{ row }">
            {{ formatDateTime(row.created_at) }}
          </template>
          <template #cell-actions="{ row }">
            <div class="flex items-center gap-1">
              <TableActionButton
                icon="users"
                :label="t('admin.organizations.viewMembers')"
                :to="{ path: '/admin/users', query: { organization_id: row.id } }"
              />
              <TableActionButton
                icon="cog"
                :label="t('admin.organizations.configureGroups')"
                @click="openScopeDialog(row)"
              />
              <TableActionButton
                :icon="row.status === 'active' ? 'ban' : 'checkCircle'"
                :label="row.status === 'active' ? t('admin.organizations.disable') : t('admin.organizations.enable')"
                :tone="row.status === 'active' ? 'warning' : 'success'"
                :disabled="statusUpdatingId === row.id"
                @click="confirmToggleStatus(row)"
              />
            </div>
          </template>
        </DataTable>

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
        <p class="truncate text-sm font-medium text-content-strong" :title="scopeDialog.name">{{ scopeDialog.name }}</p>

        <label class="flex items-start gap-2 text-sm text-content">
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
            <label class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-sunken">
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                :checked="scopeDialog.allowedGroupIds.includes(group.id)"
                @change="toggleGroup(group.id)"
              />
              <span class="text-content-strong">{{ group.name }}</span>
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

    <ConfirmDialog
      :show="statusConfirm.show"
      :title="t('admin.organizations.disable')"
      :message="t('admin.organizations.disableConfirm', { name: statusConfirm.name })"
      :confirm-text="t('common.confirm')"
      danger
      @confirm="dismissStatusConfirm(true)"
      @cancel="dismissStatusConfirm(false)"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import DataTable from '@/components/common/DataTable.vue'
import TableActionButton from '@/components/common/TableActionButton.vue'
import Pagination from '@/components/common/Pagination.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import Icon from '@/components/icons/Icon.vue'
import type { Column } from '@/components/common/types'
import adminAPI from '@/api/admin'
import type { AdminOrganization, Group } from '@/types'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()
const appStore = useAppStore()

// 组织列表不做排序：列定义全部不开 sortable，表头沿用 DataTable 的统一小字号样式
const columns = computed<Column[]>(() => [
  { key: 'name', label: t('admin.organizations.name') },
  { key: 'owner', label: t('admin.organizations.owner') },
  { key: 'member_count', label: t('admin.organizations.memberCount'), class: 'text-right' },
  { key: 'status', label: t('common.status') },
  { key: 'group_scope', label: t('admin.organizations.groupScope') },
  { key: 'created_at', label: t('admin.organizations.createdAt') },
  { key: 'actions', label: t('common.actions') }
])

const organizations = ref<AdminOrganization[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const search = ref('')
const loading = ref(true)
const loadError = ref(false)

const statusUpdatingId = ref<number | null>(null)
const groups = ref<Group[]>([])
const groupsLoading = ref(false)

// 停用组织影响全体成员调用，先确认再执行；启用是恢复性操作，直接执行。
const statusConfirm = reactive({
  show: false,
  name: '',
  organization: null as AdminOrganization | null
})

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
  loadError.value = false
  try {
    const result = await adminAPI.organizations.list(page.value, pageSize.value, {
      search: search.value.trim() || undefined
    })
    organizations.value = result.items || []
    total.value = result.total
  } catch (error) {
    loadError.value = true
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
  const disabling = organization.status === 'active'
  statusUpdatingId.value = organization.id
  try {
    const updated = await adminAPI.organizations.updateStatus(
      organization.id,
      disabling ? 'disabled' : 'active'
    )
    const index = organizations.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) {
      organizations.value.splice(index, 1, updated)
    }
    appStore.showSuccess(t('admin.organizations.statusUpdated'))
  } catch (error) {
    const fallback = t(disabling ? 'admin.organizations.disableFailed' : 'admin.organizations.enableFailed')
    appStore.showError(extractApiErrorMessage(error, fallback))
  } finally {
    statusUpdatingId.value = null
  }
}

function confirmToggleStatus(organization: AdminOrganization): void {
  if (organization.status === 'active') {
    statusConfirm.name = organization.name
    statusConfirm.organization = organization
    statusConfirm.show = true
    return
  }
  void toggleStatus(organization)
}

// confirmed=true 表示用户点了确认；否则只是关掉弹窗。
function dismissStatusConfirm(confirmed: boolean): void {
  statusConfirm.show = false
  if (confirmed && statusConfirm.organization) {
    void toggleStatus(statusConfirm.organization)
  }
  statusConfirm.organization = null
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
