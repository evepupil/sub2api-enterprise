<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <h1 class="truncate text-lg font-semibold text-content-strong">
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

      <div
        v-if="organization && organization.status === 'disabled'"
        class="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200"
      >
        {{ t('organization.suspended') }}
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
        <!-- 审批卡只挂载一次，有待处理时用 order 提到成员表上面；换位不重建组件，筛选与滚动不丢。 -->
        <div class="flex flex-col gap-6">
        <section
          class="card overflow-hidden"
          :class="quotaSectionAbove ? 'order-2' : 'order-1'"
        >
          <div
            class="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-dark-700 lg:flex-row lg:items-center lg:justify-between"
          >
            <h2 class="text-base font-semibold text-content-strong">
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
              <div class="flex shrink-0 gap-2">
                <button
                  type="button"
                  class="btn btn-secondary"
                  :disabled="selectedUserIds.length === 0"
                  @click="openQuotaGrantDialog"
                >
                  {{ t('organization.quotaGrant') }}{{ selectedSuffix }}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary"
                  :disabled="selectedUserIds.length === 0"
                  @click="openSplitDialog"
                >
                  {{ t('organization.split') }}{{ selectedSuffix }}
                </button>
              </div>
            </div>
          </div>

          <DataTable
            :columns="memberColumns"
            :data="members"
            :loading="membersLoading"
            row-key="user_id"
          >
            <template #empty>
              <div v-if="membersError" class="empty-state">
                <p class="empty-state-title">{{ t('organization.memberLoadFailed') }}</p>
                <button type="button" class="btn btn-secondary btn-sm mt-3" @click="loadMembers">
                  {{ t('organization.retry') }}
                </button>
              </div>
              <div v-else class="empty-state">
                <Icon name="inbox" class="empty-state-icon" />
                <p class="empty-state-title">{{ t('organization.memberEmpty') }}</p>
                <p class="empty-state-description">{{ t('organization.memberEmptyHint') }}</p>
              </div>
            </template>

            <template #header-select>
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                :checked="allSelectableChecked"
                :indeterminate="someSelectableChecked"
                :disabled="selectableMembers.length === 0"
                :aria-label="t('common.selectAll')"
                @change="toggleSelectAll"
              />
            </template>

            <template #cell-select="{ row }">
              <input
                v-if="!row.is_owner"
                type="checkbox"
                class="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                :checked="selectedUserIds.includes(row.user_id)"
                :aria-label="row.display_name || row.email"
                @change="toggleSelect(row.user_id)"
              />
            </template>

            <template #cell-display_name="{ row }">
              <span class="font-medium text-content-strong">{{ row.display_name || '-' }}</span>
            </template>

            <template #cell-email="{ row }">
              <div class="max-w-[16rem] truncate text-content" :title="row.email">{{ row.email }}</div>
              <div v-if="row.username" class="max-w-[16rem] truncate text-xs text-content-muted" :title="row.username">
                {{ row.username }}
              </div>
            </template>

            <template #cell-status="{ row }">
              <span
                v-if="row.is_owner"
                class="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
              >
                {{ t('organization.owner') }}
              </span>
              <span
                v-else
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

            <template #cell-spending_limit="{ row }">
              <template v-if="row.is_owner">-</template>
              <template v-else-if="row.quota">
                <div class="font-mono">{{ formatCurrency(row.quota.amount) }}</div>
                <div class="text-xs text-content-muted">
                  {{ t('organization.quotaEveryDays', { days: row.quota.period_days }) }}
                  <span v-if="row.quota.mode === 'periodic_pending'">
                    · {{ t('organization.quotaPending') }}
                  </span>
                </div>
              </template>
              <template v-else>{{ formatSpending(row.spending_limit) }}</template>
            </template>

            <template #cell-spending_used="{ row }">
              <span v-if="!row.is_owner" class="font-mono">{{ formatCurrency(row.spending_used) }}</span>
              <span v-else>-</span>
            </template>

            <template #cell-spending_remaining="{ row }">
              <span
                v-if="!row.is_owner"
                class="font-mono"
                :class="
                  isExhausted(row)
                    ? 'font-medium text-amber-600 dark:text-amber-400'
                    : 'text-content'
                "
              >
                {{ formatSpending(row.spending_remaining) }}
              </span>
              <span v-else>-</span>
              <div
                v-if="!row.is_owner && row.quota?.mode === 'periodic_active' && row.quota.window_end"
                class="text-xs text-content-muted"
              >
                {{ t('organization.quotaResetAt', { date: formatDateTime(row.quota.window_end) }) }}
              </div>
              <div
                v-if="!row.is_owner && row.spending_frozen > 0"
                class="text-xs text-content-muted"
              >
                {{ t('organization.spendingFrozen') }} {{ formatCurrency(row.spending_frozen) }}
              </div>
            </template>

            <template #cell-actions="{ row }">
              <div class="flex items-center gap-1">
                <TableActionButton
                  icon="edit"
                  :label="t('organization.rename')"
                  :disabled="renamingId === row.user_id"
                  @click="openRenameDialog(row)"
                />
                <TableActionButton
                  v-if="!row.is_owner"
                  icon="dollar"
                  :label="t('organization.quotaTitle')"
                  @click="openLimitDialog(row)"
                />
                <TableActionButton
                  v-if="!row.is_owner"
                  :icon="row.status === 'active' ? 'ban' : 'checkCircle'"
                  :label="row.status === 'active' ? t('organization.disableMember') : t('organization.enableMember')"
                  :tone="row.status === 'active' ? 'warning' : 'success'"
                  :disabled="statusUpdatingId === row.user_id"
                  @click="confirmToggleMemberStatus(row)"
                />
              </div>
            </template>
          </DataTable>

          <Pagination
            v-if="memberTotal > 0"
            :total="memberTotal"
            :page="page"
            :page-size="pageSize"
            @update:page="handlePageChange"
            @update:pageSize="handlePageSizeChange"
          />
        </section>

        <OrganizationQuotaRequestsCard
          :class="quotaSectionAbove ? 'order-1' : 'order-2'"
          @loaded="onQuotaSectionLoaded"
          @changed="loadMembers"
        />

        <section class="card overflow-hidden order-3">
          <div class="border-b border-gray-200 px-5 py-4 dark:border-dark-700">
            <h2 class="text-base font-semibold text-content-strong">
              {{ t('organization.invitations') }}
            </h2>
          </div>

          <div
            v-if="invitations.length === 0"
            class="empty-state px-5 py-12"
          >
            <Icon name="inbox" class="empty-state-icon" />
            <p class="empty-state-title">{{ t('organization.invitationEmpty') }}</p>
          </div>

          <ul v-else class="divide-y divide-line-subtle">
            <li
              v-for="invitation in invitations"
              :key="invitation.id"
              class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
            >
              <div class="min-w-0 flex-1">
                <code class="block break-all text-sm font-semibold text-content-strong">
                  {{ invitation.code }}
                </code>
                <div class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-muted">
                  <span>{{ t('organization.createdAt') }}: {{ formatDateTime(invitation.created_at) }}</span>
                  <span>
                    {{ t('organization.expiresAt') }}:
                    {{ invitation.expires_at ? formatDateTime(invitation.expires_at) : t('organization.neverExpires') }}
                  </span>
                </div>
              </div>

              <div
                v-if="invitationCopyable(invitation)"
                class="flex shrink-0 flex-wrap items-center gap-2"
              >
                <span :class="statusClass(invitation)" class="rounded-full px-2.5 py-1 text-xs font-medium">
                  {{ t(`organization.status.${effectiveStatus(invitation)}`) }}
                </span>
                <TableActionButton
                  icon="copy"
                  :label="t('organization.copyCode')"
                  @click="copyInvitation(invitation.code)"
                />
                <TableActionButton
                  icon="link"
                  :label="t('organization.copyLink')"
                  :title="inviteLink(invitation.code)"
                  @click="copyInviteLink(invitation.code)"
                />
                <TableActionButton
                  v-if="effectiveStatus(invitation) === 'unused'"
                  icon="ban"
                  :label="t('organization.disableInvitation')"
                  tone="warning"
                  :disabled="disablingId === invitation.id"
                  @click="confirmDisableInvitation(invitation)"
                />
              </div>
              <div v-else class="flex shrink-0 items-center">
                <span :class="statusClass(invitation)" class="rounded-full px-2.5 py-1 text-xs font-medium">
                  {{ t(`organization.status.${effectiveStatus(invitation)}`) }}
                </span>
              </div>
            </li>
          </ul>
        </section>
        </div>
      </template>

      <template v-else>
        <OrganizationMyQuotaRequestsCard />
      </template>
    </div>

    <BaseDialog
      :show="renameDialog.show"
      :title="t('organization.rename')"
      width="narrow"
      @close="renameDialog.show = false"
    >
      <form class="space-y-4" @submit.prevent="submitRename">
        <div class="space-y-2">
          <label class="input-label" for="member-display-name">{{ t('organization.memberName') }}</label>
          <input
            id="member-display-name"
            v-model="renameDialog.name"
            type="text"
            maxlength="50"
            class="input w-full"
          />
        </div>
        <p v-if="renameDialog.error" class="text-sm text-red-600 dark:text-red-400">{{ renameDialog.error }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-secondary" @click="renameDialog.show = false">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn btn-primary" :disabled="renameDialog.saving">
            {{ renameDialog.saving ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog
      :show="limitDialog.show"
      :title="t('organization.quotaTitle')"
      width="narrow"
      @close="closeLimitDialog"
    >
      <div class="space-y-4">
        <p class="text-sm text-content">{{ limitDialog.email }}</p>
        <div class="space-y-2">
          <label class="flex items-center gap-2 text-sm text-content">
            <input
              type="radio"
              name="quota-mode"
              class="h-4 w-4 cursor-pointer border-gray-300 text-primary-600 focus:ring-primary-500"
              value="unlimited"
              v-model="limitDialog.mode"
            />
            <span>{{ t('organization.quotaModeUnlimited') }}</span>
          </label>
          <label class="flex items-center gap-2 text-sm text-content">
            <input
              type="radio"
              name="quota-mode"
              class="h-4 w-4 cursor-pointer border-gray-300 text-primary-600 focus:ring-primary-500"
              value="fixed"
              v-model="limitDialog.mode"
            />
            <span>{{ t('organization.quotaModeFixed') }}</span>
          </label>
          <label class="flex items-center gap-2 text-sm text-content">
            <input
              type="radio"
              name="quota-mode"
              class="h-4 w-4 cursor-pointer border-gray-300 text-primary-600 focus:ring-primary-500"
              value="periodic"
              v-model="limitDialog.mode"
            />
            <span>{{ t('organization.quotaModePeriodic') }}</span>
          </label>
        </div>
        <input
          v-if="limitDialog.mode === 'fixed'"
          v-model="limitDialog.amount"
          type="number"
          min="0"
          step="0.01"
          class="input"
          :placeholder="t('organization.amount')"
        />
        <p v-if="limitDialog.mode === 'fixed'" class="text-xs text-content-muted">
          {{ t('organization.quotaFixedHint') }}
        </p>
        <p v-if="limitDialog.mode === 'unlimited'" class="text-xs text-content-muted">
          {{ t('organization.quotaUnlimitedHint') }}
        </p>
        <!-- 该成员已设周期配额时，换模式保存会清掉原周期配置，提前说明后果 -->
        <p
          v-if="limitDialog.hadQuota && limitDialog.mode !== 'periodic'"
          class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        >
          {{ t('organization.quotaSwitchClearsPeriodic') }}
        </p>
        <div v-if="limitDialog.mode === 'periodic'" class="space-y-3">
          <input
            v-model="limitDialog.amount"
            type="number"
            min="0"
            step="0.01"
            class="input"
            :placeholder="t('organization.quotaPerPeriodAmount')"
          />
          <input
            v-model="limitDialog.periodDays"
            type="number"
            min="1"
            max="3650"
            step="1"
            class="input"
            :placeholder="t('organization.quotaPeriodDays')"
          />
          <label class="flex items-center gap-2 text-sm text-content">
            <input
              v-model="limitDialog.immediate"
              type="checkbox"
              data-testid="quota-immediate"
              class="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>{{ t('organization.quotaImmediate') }}</span>
          </label>
          <div v-if="!limitDialog.immediate">
            <input
              v-model="limitDialog.startAt"
              type="datetime-local"
              class="input"
              :placeholder="t('organization.quotaStartTime')"
            />
            <p class="mt-1 text-xs text-content-muted">{{ t('organization.quotaStartTimeHint') }}</p>
          </div>
        </div>
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
            <span class="min-w-0 truncate text-content">{{ item.email }}</span>
            <span class="shrink-0 font-medium text-content-strong">{{ formatCurrency(item.amount) }}</span>
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

    <BaseDialog :show="quotaGrantDialog.show" :title="t('organization.quotaGrant')" @close="closeQuotaGrantDialog">
      <div class="space-y-3">
        <input
          v-model="quotaGrantDialog.amount"
          type="number"
          min="0"
          step="0.01"
          class="input"
          :placeholder="t('organization.quotaPerPeriodAmount')"
        />
        <input
          v-model="quotaGrantDialog.periodDays"
          type="number"
          min="1"
          max="3650"
          step="1"
          class="input"
          :placeholder="t('organization.quotaPeriodDays')"
        />
        <label class="flex items-center gap-2 text-sm text-content">
          <input
            v-model="quotaGrantDialog.immediate"
            type="checkbox"
            data-testid="quota-immediate"
            class="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>{{ t('organization.quotaImmediate') }}</span>
        </label>
        <div v-if="!quotaGrantDialog.immediate">
          <input
            v-model="quotaGrantDialog.startAt"
            type="datetime-local"
            class="input"
            :placeholder="t('organization.quotaStartTime')"
          />
          <p class="mt-1 text-xs text-content-muted">{{ t('organization.quotaStartTimeHint') }}</p>
        </div>
        <p v-if="quotaGrantDialog.error" class="text-sm text-red-600 dark:text-red-400">
          {{ quotaGrantDialog.error }}
        </p>
      </div>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="closeQuotaGrantDialog">
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="quotaGrantDialog.saving" @click="submitQuotaGrant">
          {{ t('common.confirm') }}
        </button>
      </template>
    </BaseDialog>

    <ConfirmDialog
      :show="memberStatusConfirm.show"
      :title="t('organization.disableMember')"
      :message="t('organization.disableMemberConfirm', { name: memberStatusConfirm.member?.display_name || memberStatusConfirm.member?.email || '' })"
      :confirm-text="t('common.confirm')"
      danger
      @confirm="dismissMemberStatusConfirm(true)"
      @cancel="dismissMemberStatusConfirm(false)"
    />

    <ConfirmDialog
      :show="invitationConfirm.show"
      :title="t('organization.disableInvitation')"
      :message="t('organization.disableInvitationConfirm')"
      :confirm-text="t('common.confirm')"
      danger
      @confirm="dismissInvitationConfirm(true)"
      @cancel="dismissInvitationConfirm(false)"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import DataTable from '@/components/common/DataTable.vue'
import TableActionButton from '@/components/common/TableActionButton.vue'
import Pagination from '@/components/common/Pagination.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import Select, { type SelectOption } from '@/components/common/Select.vue'
import type { Column } from '@/components/common/types'
import OrganizationQuotaRequestsCard from '@/components/user/organization/OrganizationQuotaRequestsCard.vue'
import OrganizationMyQuotaRequestsCard from '@/components/user/organization/OrganizationMyQuotaRequestsCard.vue'
import organizationAPI from '@/api/organization'
import type { OrganizationInvitation, OrganizationMember, OrganizationSummary } from '@/types'
import { useAppStore } from '@/stores/app'
import { useClipboard } from '@/composables/useClipboard'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { previewSpendingSplit } from '@/utils/organizationSpending'
import { datetimeLocalToISO } from '@/utils/quotaTime'

const { t } = useI18n()
const appStore = useAppStore()
const { copyToClipboard } = useClipboard()

const organization = ref<OrganizationSummary | null>(null)
const invitations = ref<OrganizationInvitation[]>([])
const loading = ref(true)
const creating = ref(false)
const disablingId = ref<number | null>(null)
// 先批后加且有待处理时，配额申请块排在成员表上面，避免漏批。
const quotaSectionAbove = ref(false)

function onQuotaSectionLoaded(summary: { mode: string; hasPending: boolean }): void {
  quotaSectionAbove.value = summary.mode === 'approve' && summary.hasPending
}
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
const membersError = ref(false)
// 成员表不做排序：列全部不开 sortable，表头沿用 DataTable 的统一小字号样式
const memberColumns = computed<Column[]>(() => [
  { key: 'select', label: '', class: 'w-10 text-center' },
  { key: 'display_name', label: t('organization.memberName') },
  { key: 'email', label: t('common.email') },
  { key: 'status', label: t('common.status') },
  { key: 'spending_limit', label: t('organization.spendingLimit'), class: 'text-right' },
  { key: 'spending_used', label: t('organization.spendingUsed'), class: 'text-right' },
  { key: 'spending_remaining', label: t('organization.spendingRemaining'), class: 'text-right' },
  { key: 'actions', label: t('common.actions') }
])
const page = ref(1)
const pageSize = ref(20)
const search = ref('')
const statusFilter = ref('')
const selectedUserIds = ref<number[]>([])
const statusUpdatingId = ref<number | null>(null)

// 改名弹窗：组织内名称必填 1-50 字，不限制重名（邮箱本身唯一）。
const renameDialog = reactive({
  show: false,
  userId: 0,
  name: '',
  error: '',
  saving: false
})
const renamingId = ref<number | null>(null)

function openRenameDialog(member: OrganizationMember): void {
  renameDialog.userId = member.user_id
  renameDialog.name = member.display_name || ''
  renameDialog.error = ''
  renameDialog.show = true
}

async function submitRename(): Promise<void> {
  const name = renameDialog.name.trim()
  if (!name || name.length > 50) {
    renameDialog.error = t('organization.memberNameInvalid')
    return
  }
  renameDialog.saving = true
  renameDialog.error = ''
  renamingId.value = renameDialog.userId
  try {
    const updated = await organizationAPI.updateOrganizationMemberDisplayName(renameDialog.userId, name)
    const index = members.value.findIndex((item) => item.user_id === updated.user_id)
    if (index >= 0) members.value.splice(index, 1, updated)
    renameDialog.show = false
    appStore.showSuccess(t('common.saved'))
  } catch (error) {
    renameDialog.error = extractApiErrorMessage(error, t('organization.memberUpdateFailed'))
  } finally {
    renameDialog.saving = false
    renamingId.value = null
  }
}

// 配额编辑弹窗：不限额 / 固定累计 / 周期 三种模式互斥，切换即生效另一种退出。
const limitDialog = reactive({
  show: false,
  userId: 0,
  email: '',
  mode: 'unlimited' as 'unlimited' | 'fixed' | 'periodic',
  // 打开时成员是否已有周期配额：换模式保存会清掉它，弹窗里要提示后果
  hadQuota: false,
  amount: '',
  periodDays: '',
  // 立即生效默认勾上：设了就当场换一期；取消勾选才展开定时生效的时间输入
  immediate: true,
  startAt: '',
  error: '',
  saving: false
})

const splitDialog = reactive({
  show: false,
  amount: '',
  error: '',
  saving: false
})

// 批量周期发放：选中成员统一套同一份周期配额。
const quotaGrantDialog = reactive({
  show: false,
  amount: '',
  periodDays: '',
  // 与单人设置同一条规则：默认立即生效，取消勾选才定时。
  immediate: true,
  startAt: '',
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

const someSelectableChecked = computed(() => {
  if (allSelectableChecked.value) return false
  return selectableMembers.value.some((member) => selectedUserIds.value.includes(member.user_id))
})

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
  membersError.value = false
  try {
    const result = await organizationAPI.listOrganizationMembers({
      page: page.value,
      page_size: pageSize.value,
      search: search.value.trim(),
      status: statusFilter.value
    })
    members.value = result.items || []
    memberTotal.value = result.total
    // 勾选跨页保留：翻页/筛选后不清空，已选的人不在当前页也照样参与批量操作。
  } catch (error) {
    membersError.value = true
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

// 表头勾选只作用于当前页：勾上补选本页，取消只移除本页，其他页的选择不动。
function toggleSelectAll(): void {
  const pageIds = selectableMembers.value.map((member) => member.user_id)
  if (allSelectableChecked.value) {
    const pageSet = new Set(pageIds)
    selectedUserIds.value = selectedUserIds.value.filter((id) => !pageSet.has(id))
    return
  }
  selectedUserIds.value = [...new Set([...selectedUserIds.value, ...pageIds])]
}

const selectedSuffix = computed(() =>
  selectedUserIds.value.length > 0 ? ` (${selectedUserIds.value.length})` : ''
)

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
    appStore.showSuccess(t('organization.memberStatusUpdated'))
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.memberUpdateFailed')))
  } finally {
    statusUpdatingId.value = null
  }
}

// 停用成员立即切断调用，单击误触代价高，先确认再执行；启用是恢复性操作，直接执行。
const memberStatusConfirm = reactive({ show: false, member: null as OrganizationMember | null })

function confirmToggleMemberStatus(member: OrganizationMember): void {
  if (member.status === 'active') {
    memberStatusConfirm.member = member
    memberStatusConfirm.show = true
    return
  }
  void toggleMemberStatus(member)
}

// confirmed=true 表示用户点了确认；否则只是关掉弹窗。
function dismissMemberStatusConfirm(confirmed: boolean): void {
  memberStatusConfirm.show = false
  if (confirmed && memberStatusConfirm.member) {
    void toggleMemberStatus(memberStatusConfirm.member)
  }
  memberStatusConfirm.member = null
}

function openLimitDialog(member: OrganizationMember): void {
  limitDialog.show = true
  limitDialog.userId = member.user_id
  limitDialog.email = member.email
  limitDialog.immediate = true
  limitDialog.startAt = ''
  if (member.quota) {
    limitDialog.mode = 'periodic'
    limitDialog.amount = String(member.quota.amount)
    limitDialog.periodDays = String(member.quota.period_days)
  } else if (member.spending_limit === null) {
    limitDialog.mode = 'unlimited'
    limitDialog.amount = ''
    limitDialog.periodDays = ''
  } else {
    limitDialog.mode = 'fixed'
    limitDialog.amount = String(member.spending_limit)
    limitDialog.periodDays = ''
  }
  limitDialog.hadQuota = Boolean(member.quota)
  limitDialog.error = ''
}

function closeLimitDialog(): void {
  limitDialog.show = false
}

// 校验周期配额的公共字段；返回 'amount' / 'period' 表示对应字段非法。
function validatePeriodicInput(
  amount: string,
  periodDays: string
): { amount: number; periodDays: number } | 'amount' | 'period' {
  const parsedAmount = Number(amount)
  if (amount === '' || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
    return 'amount'
  }
  const parsedDays = Number(periodDays)
  if (periodDays === '' || !Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 3650) {
    return 'period'
  }
  return { amount: parsedAmount, periodDays: parsedDays }
}

async function saveLimit(): Promise<void> {
  if (limitDialog.mode === 'unlimited') {
    await saveStaticLimit(null)
    return
  }
  if (limitDialog.mode === 'fixed') {
    const parsed = Number(limitDialog.amount)
    if (limitDialog.amount === '' || !Number.isFinite(parsed) || parsed < 0) {
      limitDialog.error = t('organization.invalidAmount')
      return
    }
    await saveStaticLimit(parsed)
    return
  }
  const periodic = validatePeriodicInput(limitDialog.amount, limitDialog.periodDays)
  if (periodic === 'amount') {
    limitDialog.error = t('organization.invalidAmount')
    return
  }
  if (periodic === 'period') {
    limitDialog.error = t('organization.invalidPeriodDays')
    return
  }
  // 定时生效必须给出时间；立即生效不带 start_at，由服务端取当前时刻。
  if (!limitDialog.immediate && !datetimeLocalToISO(limitDialog.startAt)) {
    limitDialog.error = t('organization.quotaStartTimeRequired')
    return
  }

  limitDialog.saving = true
  limitDialog.error = ''
  try {
    const updated = await organizationAPI.updateOrganizationMemberQuota(limitDialog.userId, {
      amount: periodic.amount,
      period_days: periodic.periodDays,
      ...(limitDialog.immediate
        ? {}
        : { start_at: datetimeLocalToISO(limitDialog.startAt) })
    })
    replaceMember(updated)
    limitDialog.show = false
    appStore.showSuccess(t('organization.quotaSaved'))
  } catch (error) {
    limitDialog.error = extractApiErrorMessage(error, t('organization.memberUpdateFailed'))
  } finally {
    limitDialog.saving = false
  }
}

// 静态两种模式走原接口，后端会同时清掉周期配置。
async function saveStaticLimit(limit: number | null): Promise<void> {
  limitDialog.saving = true
  limitDialog.error = ''
  try {
    const updated = await organizationAPI.updateOrganizationMemberSpendingLimit(limitDialog.userId, limit)
    replaceMember(updated)
    limitDialog.show = false
    appStore.showSuccess(t('organization.quotaSaved'))
  } catch (error) {
    limitDialog.error = extractApiErrorMessage(error, t('organization.memberUpdateFailed'))
  } finally {
    limitDialog.saving = false
  }
}

function openQuotaGrantDialog(): void {
  quotaGrantDialog.show = true
  quotaGrantDialog.amount = ''
  quotaGrantDialog.periodDays = ''
  quotaGrantDialog.immediate = true
  quotaGrantDialog.startAt = ''
  quotaGrantDialog.error = ''
}

function closeQuotaGrantDialog(): void {
  quotaGrantDialog.show = false
}

async function submitQuotaGrant(): Promise<void> {
  const periodic = validatePeriodicInput(quotaGrantDialog.amount, quotaGrantDialog.periodDays)
  if (periodic === 'amount') {
    quotaGrantDialog.error = t('organization.invalidAmount')
    return
  }
  if (periodic === 'period') {
    quotaGrantDialog.error = t('organization.invalidPeriodDays')
    return
  }
  if (!quotaGrantDialog.immediate && !datetimeLocalToISO(quotaGrantDialog.startAt)) {
    quotaGrantDialog.error = t('organization.quotaStartTimeRequired')
    return
  }

  quotaGrantDialog.saving = true
  quotaGrantDialog.error = ''
  try {
    const updated = await organizationAPI.batchSetOrganizationMemberQuota(
      [...selectedUserIds.value],
      {
        amount: periodic.amount,
        period_days: periodic.periodDays,
        ...(quotaGrantDialog.immediate
          ? {}
          : { start_at: datetimeLocalToISO(quotaGrantDialog.startAt) })
      }
    )
    updated.forEach(replaceMember)
    quotaGrantDialog.show = false
    selectedUserIds.value = []
    appStore.showSuccess(t('organization.quotaGrantDone'))
  } catch (error) {
    quotaGrantDialog.error = extractApiErrorMessage(error, t('organization.memberUpdateFailed'))
  } finally {
    quotaGrantDialog.saving = false
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
    appStore.showSuccess(t('organization.splitDone'))
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
    appStore.showSuccess(t('organization.invitationDisabled'))
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.disableFailed')))
  } finally {
    disablingId.value = null
  }
}

const invitationConfirm = reactive({ show: false, invitation: null as OrganizationInvitation | null })

function confirmDisableInvitation(invitation: OrganizationInvitation): void {
  invitationConfirm.invitation = invitation
  invitationConfirm.show = true
}

function dismissInvitationConfirm(confirmed: boolean): void {
  invitationConfirm.show = false
  if (confirmed && invitationConfirm.invitation) {
    void disableInvitation(invitationConfirm.invitation)
  }
  invitationConfirm.invitation = null
}

// 邀请码在有效期内可重复使用：未用/已用都能继续复制拉人；过期或已停用的是死链，不再给复制入口。
function invitationCopyable(invitation: OrganizationInvitation): boolean {
  const status = effectiveStatus(invitation)
  return status === 'unused' || status === 'used'
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
    appStore.showSuccess(t('organization.invitationCreated'))
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
