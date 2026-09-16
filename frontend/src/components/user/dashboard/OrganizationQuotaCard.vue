<template>
  <div class="card p-4">
    <div class="flex items-center gap-3">
      <div class="rounded-lg bg-cyan-100 p-2 dark:bg-cyan-900/30">
        <svg class="h-5 w-5 text-cyan-700 dark:text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium text-content-muted">{{ t('dashboard.orgQuota') }}</p>
        <p v-if="overview.remaining !== null" class="text-xl font-bold text-cyan-700 dark:text-cyan-300">
          {{ formatCurrency(overview.remaining) }}
        </p>
        <p v-else class="text-xl font-bold text-content-strong">{{ t('organization.unlimited') }}</p>
        <p v-if="overview.window_end" class="text-xs text-content-muted">
          {{ t('organization.quotaResetAt', { date: formatDateTime(overview.window_end) }) }}
        </p>
        <p v-else class="text-xs text-content-muted">&nbsp;</p>
      </div>
      <button
        v-if="canApply"
        type="button"
        class="btn btn-primary btn-sm shrink-0"
        @click="openDialog"
      >
        {{ t('dashboard.orgQuotaApply') }}
      </button>
      <span
        v-else-if="overview.pending_exists"
        class="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
      >
        {{ t('dashboard.orgQuotaPending') }}
      </span>
    </div>

    <BaseDialog
      :show="dialog.show"
      :title="t('dashboard.orgQuotaApplyTitle')"
      width="narrow"
      @close="closeDialog"
    >
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <label class="input-label" for="org-quota-amount">
            {{ t('organization.amount') }}
            <span v-if="rangeLabel" class="ml-2 text-xs text-content-subtle">{{ rangeLabel }}</span>
          </label>
          <input
            id="org-quota-amount"
            v-model.number="dialog.amount"
            type="number"
            min="0"
            step="0.01"
            class="input w-full"
            :placeholder="amountPlaceholder"
          />
        </div>
        <div class="space-y-2">
          <label class="input-label" for="org-quota-reason">
            {{ t('dashboard.orgQuotaReason') }}
          </label>
          <textarea
            id="org-quota-reason"
            v-model="dialog.reason"
            rows="3"
            maxlength="500"
            class="input w-full resize-none"
          ></textarea>
        </div>
        <p v-if="dialog.error" class="text-sm text-red-600 dark:text-red-400">{{ dialog.error }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-secondary" @click="closeDialog">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn btn-primary" :disabled="dialog.saving">
            {{ dialog.saving ? t('common.submitting') : t('common.submit') }}
          </button>
        </div>
      </form>

      <!-- 最近申请：成员在提交的同一处就能看到进度并撤回，不用另找入口 -->
      <div v-if="requests.length > 0 || requestsError" class="mt-4 border-t border-line-subtle pt-3">
        <p class="mb-2 text-xs font-medium text-content-muted">{{ t('dashboard.orgQuotaRecent') }}</p>
        <div v-if="requestsError" class="flex items-center justify-between text-xs text-content-muted">
          <span>{{ t('dashboard.orgQuotaRecentFailed') }}</span>
          <button type="button" class="font-medium text-primary-600 hover:underline" @click="loadRequests">
            {{ t('common.retry') }}
          </button>
        </div>
        <ul v-else class="max-h-44 space-y-1.5 overflow-y-auto">
          <li
            v-for="request in requests"
            :key="request.id"
            class="flex items-center gap-3 text-xs"
          >
            <span class="shrink-0 font-mono text-content">{{ formatCurrency(request.amount) }}</span>
            <span class="shrink-0 text-content-muted">{{ formatDateTime(request.created_at) }}</span>
            <span
              v-if="request.reason"
              class="min-w-0 flex-1 truncate text-content-muted"
              :title="request.reason"
            >
              {{ request.reason }}
            </span>
            <span v-else class="flex-1"></span>
            <span
              v-if="request.status !== 'pending'"
              class="shrink-0 rounded-full px-2 py-0.5"
              :class="statusClass(request.status)"
            >
              {{ t(`organization.quotaRequestStatus.${request.status}`) }}
            </span>
            <button
              v-else
              type="button"
              class="shrink-0 font-medium text-primary-600 hover:underline disabled:opacity-50"
              :disabled="withdrawingId === request.id"
              @click="withdraw(request)"
            >
              {{ t('organization.quotaRequestWithdraw') }}
            </button>
          </li>
        </ul>
      </div>
    </BaseDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import { listQuotaRequests, submitQuotaRequest, withdrawQuotaRequest } from '@/api/organization'
import type { OrganizationQuotaRequest, UserOrganizationQuotaOverview } from '@/types'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatCurrency, formatDateTime } from '@/utils/format'

const props = defineProps<{
  overview: UserOrganizationQuotaOverview
}>()

const emit = defineEmits<{
  (e: 'applied'): void
}>()

const { t } = useI18n()
const appStore = useAppStore()

// 不限额成员没有追加对象，按钮不出现；有待处理单时先等审批。
const canApply = computed(() => props.overview.can_request && !props.overview.pending_exists)

const rangeLabel = computed(() => {
  if (props.overview.min_amount === null || props.overview.max_amount === null) return ''
  return `${formatCurrency(props.overview.min_amount)} - ${formatCurrency(props.overview.max_amount)}`
})

const amountPlaceholder = computed(() =>
  props.overview.min_amount !== null ? formatCurrency(props.overview.min_amount) : '0.00'
)

const dialog = reactive({
  show: false,
  amount: '' as number | '',
  reason: '',
  error: '',
  saving: false
})

const requests = ref<OrganizationQuotaRequest[]>([])
const requestsError = ref(false)
const withdrawingId = ref<number | null>(null)

// 服务端按身份分流：普通成员只拿得到自己的申请。
async function loadRequests(): Promise<void> {
  requestsError.value = false
  try {
    const result = await listQuotaRequests({ page: 1, page_size: 10 })
    requests.value = result.items || []
  } catch {
    requestsError.value = true
  }
}

function openDialog(): void {
  dialog.amount = props.overview.min_amount ?? ''
  dialog.reason = ''
  dialog.error = ''
  dialog.show = true
  void loadRequests()
}

function closeDialog(): void {
  dialog.show = false
}

async function submit(): Promise<void> {
  const amount = typeof dialog.amount === 'number' ? dialog.amount : Number(dialog.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    dialog.error = t('dashboard.orgQuotaAmountRequired')
    return
  }
  dialog.saving = true
  dialog.error = ''
  try {
    await submitQuotaRequest(amount, dialog.reason.trim() || undefined)
    // 弹框不关：新单立刻出现在下面的记录里，带撤回入口。
    dialog.amount = props.overview.min_amount ?? ''
    dialog.reason = ''
    appStore.showSuccess(t('dashboard.orgQuotaSubmitted'))
    emit('applied')
    await loadRequests()
  } catch (error) {
    dialog.error = extractApiErrorMessage(error, t('dashboard.orgQuotaSubmitFailed'))
  } finally {
    dialog.saving = false
  }
}

async function withdraw(request: OrganizationQuotaRequest): Promise<void> {
  withdrawingId.value = request.id
  try {
    await withdrawQuotaRequest(request.id)
    appStore.showSuccess(t('organization.quotaRequestWithdrawn'))
    emit('applied')
    await loadRequests()
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.memberUpdateFailed')))
  } finally {
    withdrawingId.value = null
  }
}

function statusClass(status: OrganizationQuotaRequest['status']): string {
  switch (status) {
    case 'granted':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
    case 'rejected':
      return 'bg-gray-100 text-content-muted dark:bg-dark-700 dark:text-dark-300'
    default:
      return 'bg-gray-100 text-content-muted dark:bg-dark-700 dark:text-dark-300'
  }
}
</script>
