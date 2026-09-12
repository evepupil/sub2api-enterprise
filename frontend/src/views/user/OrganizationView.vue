<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <h1 class="truncate text-xl font-semibold text-gray-900 dark:text-white">
            {{ organization?.name || t('organization.title') }}
          </h1>
          <span
            v-if="organization?.is_owner"
            class="mt-2 inline-flex rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
          >
            {{ t('organization.owner') }}
          </span>
        </div>

        <div v-if="organization?.is_owner" class="flex shrink-0 items-center gap-2">
          <div class="w-36">
            <Select v-model="invitationValidity" :options="validityOptions" />
          </div>
          <button type="button" class="btn btn-primary" :disabled="creating" @click="createInvitation">
            <Icon :name="creating ? 'refresh' : 'plus'" size="sm" :class="{ 'animate-spin': creating }" />
            <span>{{ creating ? t('organization.creatingInvitation') : t('organization.createInvitation') }}</span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-16" aria-live="polite">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
      </div>

      <div
        v-else-if="loadError"
        class="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-900/20"
      >
        <p class="text-sm text-red-700 dark:text-red-300">{{ loadError }}</p>
        <button type="button" class="btn btn-secondary btn-sm mt-4" @click="loadOrganization">
          <Icon name="refresh" size="sm" />
          <span>{{ t('organization.retry') }}</span>
        </button>
      </div>

      <div
        v-else-if="!organization"
        class="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center text-sm text-gray-500 dark:border-dark-700 dark:text-dark-400"
      >
        {{ t('organization.noOrganization') }}
      </div>

      <template v-else-if="organization.is_owner">
        <section class="card overflow-hidden">
          <div
            class="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-dark-700 lg:flex-row lg:items-center lg:justify-between"
          >
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('organization.members') }}
            </h2>

            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <SearchInput
                v-model="search"
                class="sm:w-56"
                :placeholder="t('organization.searchMember')"
                @search="applyMemberFilters"
              />
              <div class="sm:w-36">
                <Select v-model="statusFilter" :options="statusOptions" @update:model-value="applyMemberFilters" />
              </div>
              <button
                type="button"
                class="btn btn-secondary shrink-0"
                :disabled="selectedUserIds.length === 0"
                @click="openSplitDialog"
              >
                {{ t('organization.split') }}
              </button>
            </div>
          </div>

          <div v-if="membersLoading" class="flex justify-center py-12">
            <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
          </div>

          <div
            v-else-if="members.length === 0"
            class="px-5 py-12 text-center text-sm text-gray-500 dark:text-dark-400"
          >
            {{ t('organization.memberEmpty') }}
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr class="border-b border-gray-200 text-gray-500 dark:border-dark-700 dark:text-dark-400">
                  <th class="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      class="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      :checked="allSelectableChecked"
                      :disabled="selectableMembers.length === 0"
                      @change="toggleSelectAll"
                    />
                  </th>
                  <th class="px-3 py-2 font-medium">{{ t('common.email') }}</th>
                  <th class="px-3 py-2 font-medium">{{ t('common.status') }}</th>
                  <th class="px-3 py-2 text-right font-medium">{{ t('organization.spendingLimit') }}</th>
                  <th class="px-3 py-2 text-right font-medium">{{ t('organization.spendingUsed') }}</th>
                  <th class="px-3 py-2 text-right font-medium">{{ t('organization.spendingRemaining') }}</th>
                  <th class="px-3 py-2 text-right font-medium">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="member in members"
                  :key="member.user_id"
                  class="border-b border-gray-100 last:border-b-0 dark:border-dark-800"
                >
                  <td class="px-3 py-3">
                    <input
                      v-if="!member.is_owner"
                      type="checkbox"
                      class="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      :checked="selectedUserIds.includes(member.user_id)"
                      @change="toggleSelect(member.user_id)"
                    />
                  </td>
                  <td class="px-3 py-3">
                    <div class="font-medium text-gray-900 dark:text-white">{{ member.email }}</div>
                    <div v-if="member.username" class="text-xs text-gray-500 dark:text-dark-400">
                      {{ member.username }}
                    </div>
                  </td>
                  <td class="px-3 py-3">
                    <span
                      v-if="member.is_owner"
                      class="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                    >
                      {{ t('organization.owner') }}
                    </span>
                    <span
                      v-else
                      class="rounded-full px-2.5 py-1 text-xs font-medium"
                      :class="
                        member.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      "
                    >
                      {{ member.status === 'active' ? t('common.enabled') : t('common.disabled') }}
                    </span>
                  </td>
                  <td class="px-3 py-3 text-right text-gray-900 dark:text-white">
                    {{ member.is_owner ? '-' : formatSpending(member.spending_limit) }}
                  </td>
                  <td class="px-3 py-3 text-right text-gray-700 dark:text-gray-300">
                    {{ member.is_owner ? '-' : formatCurrency(member.spending_used) }}
                  </td>
                  <td
                    class="px-3 py-3 text-right"
                    :class="
                      isExhausted(member)
                        ? 'font-medium text-amber-600 dark:text-amber-400'
                        : 'text-gray-700 dark:text-gray-300'
                    "
                  >
                    {{ member.is_owner ? '-' : formatSpending(member.spending_remaining) }}
                    <div
                      v-if="!member.is_owner && member.spending_frozen > 0"
                      class="text-xs text-gray-500 dark:text-dark-400"
                    >
                      {{ t('organization.spendingFrozen') }} {{ formatCurrency(member.spending_frozen) }}
                    </div>
                  </td>
                  <td class="px-3 py-3">
                    <div v-if="!member.is_owner" class="flex justify-end gap-2">
                      <button type="button" class="btn btn-secondary btn-sm" @click="openLimitDialog(member)">
                        {{ t('organization.setLimit') }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        :disabled="statusUpdatingId === member.user_id"
                        @click="toggleMemberStatus(member)"
                      >
                        {{ member.status === 'active' ? t('organization.disableMember') : t('organization.enableMember') }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Pagination
            v-if="memberTotal > 0"
            :total="memberTotal"
            :page="page"
            :page-size="pageSize"
            @update:page="handlePageChange"
            @update:pageSize="handlePageSizeChange"
          />
        </section>

        <section class="card overflow-hidden">
          <div class="border-b border-gray-200 px-5 py-4 dark:border-dark-700">
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('organization.invitations') }}
            </h2>
          </div>

          <div
            v-if="invitations.length === 0"
            class="px-5 py-12 text-center text-sm text-gray-500 dark:text-dark-400"
          >
            {{ t('organization.invitationEmpty') }}
          </div>

          <ul v-else class="divide-y divide-gray-100 dark:divide-dark-800">
            <li
              v-for="invitation in invitations"
              :key="invitation.id"
              class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
            >
              <div class="min-w-0 flex-1">
                <code class="block break-all text-sm font-semibold text-gray-900 dark:text-white">
                  {{ invitation.code }}
                </code>
                <div class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-dark-400">
                  <span>{{ t('organization.createdAt') }}: {{ formatDateTime(invitation.created_at) }}</span>
                  <span>
                    {{ t('organization.expiresAt') }}:
                    {{ invitation.expires_at ? formatDateTime(invitation.expires_at) : t('organization.neverExpires') }}
                  </span>
                </div>
              </div>

              <div class="flex shrink-0 flex-wrap items-center gap-2">
                <span :class="statusClass(invitation)" class="rounded-full px-2.5 py-1 text-xs font-medium">
                  {{ t(`organization.status.${effectiveStatus(invitation)}`) }}
                </span>
                <button type="button" class="btn btn-secondary btn-sm" @click="copyInvitation(invitation.code)">
                  {{ t('organization.copyCode') }}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  :title="inviteLink(invitation.code)"
                  @click="copyInviteLink(invitation.code)"
                >
                  {{ t('organization.copyLink') }}
                </button>
                <button
                  v-if="effectiveStatus(invitation) === 'unused'"
                  type="button"
                  class="btn btn-secondary btn-sm"
                  :disabled="disablingId === invitation.id"
                  @click="disableInvitation(invitation)"
                >
                  {{ t('organization.disableInvitation') }}
                </button>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </div>

    <BaseDialog
      :show="limitDialog.show"
      :title="t('organization.setLimit')"
      width="narrow"
      @close="closeLimitDialog"
    >
      <div class="space-y-4">
        <p class="text-sm text-gray-700 dark:text-gray-300">{{ limitDialog.email }}</p>
        <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            class="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            v-model="limitDialog.unlimited"
          />
          <span>{{ t('organization.unlimited') }}</span>
        </label>
        <input
          v-if="!limitDialog.unlimited"
          v-model="limitDialog.amount"
          type="number"
          min="0"
          step="0.01"
          class="input"
          :placeholder="t('organization.amount')"
        />
        <p v-if="limitDialog.error" class="text-sm text-red-600 dark:text-red-400">{{ limitDialog.error }}</p>
      </div>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="closeLimitDialog">
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="limitDialog.saving" @click="saveLimit">
          {{ t('common.save') }}
        </button>
      </template>
    </BaseDialog>

    <BaseDialog :show="splitDialog.show" :title="t('organization.split')" @close="closeSplitDialog">
      <div class="space-y-4">
        <input
          v-model="splitDialog.amount"
          type="number"
          min="0"
          step="0.01"
          class="input"
          :placeholder="t('organization.splitTotal')"
        />
        <ul class="divide-y divide-gray-100 text-sm dark:divide-dark-800">
          <li
            v-for="item in splitPreview"
            :key="item.userId"
            class="flex items-center justify-between gap-3 py-2"
          >
            <span class="min-w-0 truncate text-gray-700 dark:text-gray-300">{{ item.email }}</span>
            <span class="shrink-0 font-medium text-gray-900 dark:text-white">{{ formatCurrency(item.amount) }}</span>
          </li>
        </ul>
        <p v-if="splitDialog.error" class="text-sm text-red-600 dark:text-red-400">{{ splitDialog.error }}</p>
      </div>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="closeSplitDialog">
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="splitDialog.saving" @click="submitSplit">
          {{ t('common.confirm') }}
        </button>
      </template>
    </BaseDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Pagination from '@/components/common/Pagination.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import Select, { type SelectOption } from '@/components/common/Select.vue'
import organizationAPI from '@/api/organization'
import type { OrganizationInvitation, OrganizationMember, OrganizationSummary } from '@/types'
import { useAppStore } from '@/stores/app'
import { useClipboard } from '@/composables/useClipboard'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { previewSpendingSplit } from '@/utils/organizationSpending'

const { t } = useI18n()
const appStore = useAppStore()
const { copyToClipboard } = useClipboard()

const organization = ref<OrganizationSummary | null>(null)
const invitations = ref<OrganizationInvitation[]>([])
const loading = ref(true)
const creating = ref(false)
const disablingId = ref<number | null>(null)
// 邀请码限时可重复使用，创建时选有效期；长期有效就不带过期时间。
const invitationValidity = ref<number>(7)
const validityOptions = computed<SelectOption[]>(() => [
  { value: 1, label: t('organization.validity1Day') },
  { value: 7, label: t('organization.validity7Days') },
  { value: 30, label: t('organization.validity30Days') },
  { value: 0, label: t('organization.validityForever') },
])
const loadError = ref('')

const members = ref<OrganizationMember[]>([])
const memberTotal = ref(0)
const membersLoading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const search = ref('')
const statusFilter = ref('')
const selectedUserIds = ref<number[]>([])
const statusUpdatingId = ref<number | null>(null)

const limitDialog = reactive({
  show: false,
  userId: 0,
  email: '',
  unlimited: true,
  amount: '',
  error: '',
  saving: false
})

const splitDialog = reactive({
  show: false,
  amount: '',
  error: '',
  saving: false
})

const statusOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'active', label: t('common.enabled') },
  { value: 'disabled', label: t('common.disabled') }
])

const selectableMembers = computed(() => members.value.filter((member) => !member.is_owner))

const allSelectableChecked = computed(
  () =>
    selectableMembers.value.length > 0 &&
    selectableMembers.value.every((member) => selectedUserIds.value.includes(member.user_id))
)

const splitPreview = computed(() => {
  const total = Number(splitDialog.amount)
  const shares = previewSpendingSplit(selectedUserIds.value, Number.isFinite(total) ? total : 0)
  return Array.from(shares.entries()).map(([userId, amount]) => ({
    userId,
    email: members.value.find((member) => member.user_id === userId)?.email || String(userId),
    amount
  }))
})

function formatSpending(amount: number | null): string {
  return amount === null || amount === undefined ? t('organization.unlimited') : formatCurrency(amount)
}

function isExhausted(member: OrganizationMember): boolean {
  return !member.is_owner && member.spending_remaining !== null && member.spending_remaining <= 0
}

function effectiveStatus(invitation: OrganizationInvitation): OrganizationInvitation['status'] {
  if (
    invitation.status === 'unused' &&
    invitation.expires_at &&
    new Date(invitation.expires_at).getTime() <= Date.now()
  ) {
    return 'expired'
  }
  return invitation.status
}

function statusClass(invitation: OrganizationInvitation): string {
  switch (effectiveStatus(invitation)) {
    case 'unused':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'used':
      return 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-300'
    case 'disabled':
    case 'expired':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  }
}

async function loadOrganization(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    organization.value = await organizationAPI.getCurrentOrganization()
    if (organization.value?.is_owner) {
      invitations.value = await organizationAPI.listOrganizationInvitations()
      await loadMembers()
    } else {
      invitations.value = []
      members.value = []
    }
  } catch (error) {
    loadError.value = extractApiErrorMessage(error, t('organization.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function loadMembers(): Promise<void> {
  membersLoading.value = true
  try {
    const result = await organizationAPI.listOrganizationMembers({
      page: page.value,
      page_size: pageSize.value,
      search: search.value.trim(),
      status: statusFilter.value
    })
    members.value = result.items || []
    memberTotal.value = result.total
    const visibleIds = new Set(members.value.map((member) => member.user_id))
    selectedUserIds.value = selectedUserIds.value.filter((id) => visibleIds.has(id))
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.memberLoadFailed')))
  } finally {
    membersLoading.value = false
  }
}

function applyMemberFilters(): void {
  page.value = 1
  void loadMembers()
}

function handlePageChange(value: number): void {
  page.value = value
  void loadMembers()
}

function handlePageSizeChange(value: number): void {
  pageSize.value = value
  page.value = 1
  void loadMembers()
}

function toggleSelect(userId: number): void {
  const index = selectedUserIds.value.indexOf(userId)
  if (index >= 0) {
    selectedUserIds.value.splice(index, 1)
    return
  }
  selectedUserIds.value.push(userId)
}

function toggleSelectAll(): void {
  if (allSelectableChecked.value) {
    selectedUserIds.value = []
    return
  }
  selectedUserIds.value = selectableMembers.value.map((member) => member.user_id)
}

function replaceMember(updated: OrganizationMember): void {
  const index = members.value.findIndex((member) => member.user_id === updated.user_id)
  if (index >= 0) {
    members.value.splice(index, 1, updated)
  }
}

async function toggleMemberStatus(member: OrganizationMember): Promise<void> {
  statusUpdatingId.value = member.user_id
  try {
    const updated = await organizationAPI.updateOrganizationMemberStatus(
      member.user_id,
      member.status === 'active' ? 'disabled' : 'active'
    )
    replaceMember(updated)
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.memberUpdateFailed')))
  } finally {
    statusUpdatingId.value = null
  }
}

function openLimitDialog(member: OrganizationMember): void {
  limitDialog.show = true
  limitDialog.userId = member.user_id
  limitDialog.email = member.email
  limitDialog.unlimited = member.spending_limit === null
  limitDialog.amount = member.spending_limit === null ? '' : String(member.spending_limit)
  limitDialog.error = ''
}

function closeLimitDialog(): void {
  limitDialog.show = false
}

async function saveLimit(): Promise<void> {
  let limit: number | null = null
  if (!limitDialog.unlimited) {
    const parsed = Number(limitDialog.amount)
    if (limitDialog.amount === '' || !Number.isFinite(parsed) || parsed < 0) {
      limitDialog.error = t('organization.invalidAmount')
      return
    }
    limit = parsed
  }

  limitDialog.saving = true
  limitDialog.error = ''
  try {
    const updated = await organizationAPI.updateOrganizationMemberSpendingLimit(limitDialog.userId, limit)
    replaceMember(updated)
    limitDialog.show = false
  } catch (error) {
    limitDialog.error = extractApiErrorMessage(error, t('organization.memberUpdateFailed'))
  } finally {
    limitDialog.saving = false
  }
}

function openSplitDialog(): void {
  splitDialog.show = true
  splitDialog.amount = ''
  splitDialog.error = ''
}

function closeSplitDialog(): void {
  splitDialog.show = false
}

async function submitSplit(): Promise<void> {
  const total = Number(splitDialog.amount)
  if (splitDialog.amount === '' || !Number.isFinite(total) || total < 0) {
    splitDialog.error = t('organization.invalidAmount')
    return
  }

  splitDialog.saving = true
  splitDialog.error = ''
  try {
    const updated = await organizationAPI.splitOrganizationMemberSpendingLimit(
      [...selectedUserIds.value],
      total
    )
    updated.forEach(replaceMember)
    splitDialog.show = false
    selectedUserIds.value = []
  } catch (error) {
    splitDialog.error = extractApiErrorMessage(error, t('organization.memberUpdateFailed'))
  } finally {
    splitDialog.saving = false
  }
}

function inviteLink(code: string): string {
  const base = typeof window === 'undefined' ? '' : window.location.origin
  return `${base}/register?invitation_code=${encodeURIComponent(code)}`
}

async function copyInviteLink(code: string): Promise<void> {
  await copyToClipboard(inviteLink(code), t('organization.linkCopied'))
}

async function disableInvitation(invitation: OrganizationInvitation): Promise<void> {
  disablingId.value = invitation.id
  try {
    await organizationAPI.disableOrganizationInvitation(invitation.id)
    invitation.status = 'disabled'
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.disableFailed')))
  } finally {
    disablingId.value = null
  }
}

async function createInvitation(): Promise<void> {
  if (creating.value) return
  creating.value = true
  try {
    const days = invitationValidity.value
    const expiresAt =
      days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : undefined
    const invitation = await organizationAPI.createOrganizationInvitation(expiresAt)
    invitations.value = [invitation, ...invitations.value]
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.createFailed')))
  } finally {
    creating.value = false
  }
}

async function copyInvitation(code: string): Promise<void> {
  await copyToClipboard(code, t('organization.invitationCopied'))
}

onMounted(() => {
  void loadOrganization()
})
</script>
