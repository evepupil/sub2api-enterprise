<template>
  <section class="card overflow-hidden">
    <div
      class="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-dark-700 lg:flex-row lg:items-center lg:justify-between"
    >
      <h2 class="text-base font-semibold text-content-strong">
        {{ t('organization.quotaRequests') }}
      </h2>
      <div class="flex items-center gap-2">
        <div class="w-32">
          <Select v-model="statusFilter" :options="statusOptions" @update:model-value="reloadRequests" />
        </div>
        <button type="button" class="btn btn-secondary btn-sm" @click="openPolicyDialog">
          {{ t('organization.quotaRequestMode') }}
        </button>
      </div>
    </div>

    <div v-if="policy && policy.mode !== 'off' && requestsLoading" class="flex justify-center py-10">
      <div class="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
    </div>

    <div
      v-else-if="policy && policy.mode !== 'off' && requests.length === 0"
      class="px-5 py-10 text-center text-sm text-content-muted"
    >
      {{ t('organization.quotaRequestEmpty') }}
    </div>

    <ul v-else-if="policy && policy.mode !== 'off'" class="divide-y divide-line-subtle">
      <li v-for="request in requests" :key="request.id" class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-content-strong">{{ request.display_name || request.email }}</div>
          <div v-if="request.display_name" class="text-xs text-content-muted">{{ request.email }}</div>
          <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-muted">
            <span class="font-mono text-content">{{ formatCurrency(request.amount) }}</span>
            <span v-if="request.reason">{{ request.reason }}</span>
            <span>{{ formatDateTime(request.created_at) }}</span>
            <span
              :class="statusClass(request.status)"
              class="rounded-full px-2 py-0.5"
            >
              {{ t(`organization.quotaRequestStatus.${request.status}`) }}
            </span>
            <span v-if="request.review_note" class="text-content-subtle">{{ request.review_note }}</span>
          </div>
        </div>
        <div v-if="request.status === 'pending'" class="flex shrink-0 gap-2">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="handlingId === request.id"
            @click="approve(request)"
          >
            {{ t('organization.quotaRequestApprove') }}
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="handlingId === request.id"
            @click="openReject(request)"
          >
            {{ t('organization.quotaRequestReject') }}
          </button>
        </div>
      </li>
    </ul>

    <div v-if="total > pageSize" class="border-t border-gray-200 px-5 py-3 dark:border-dark-700">
      <Pagination
        :total="total"
        :page="page"
        :page-size="pageSize"
        @update:page="handlePageChange"
        @update:pageSize="handlePageSizeChange"
      />
    </div>

    <BaseDialog
      :show="policyDialog.show"
      :title="t('organization.quotaRequestMode')"
      width="narrow"
      @close="closePolicyDialog"
    >
      <form class="space-y-4" @submit.prevent="savePolicy">
        <div class="space-y-2">
          <label class="input-label">{{ t('organization.quotaRequestMode') }}</label>
          <Select v-model="policyDialog.mode" :options="modeOptions" />
        </div>
        <template v-if="policyDialog.mode !== 'off'">
          <div class="space-y-2">
            <label class="input-label" for="quota-request-min">{{ t('organization.quotaRequestMin') }}</label>
            <input
              id="quota-request-min"
              v-model.number="policyDialog.min"
              type="number"
              min="0"
              step="0.01"
              class="input w-full"
            />
          </div>
          <div class="space-y-2">
            <label class="input-label" for="quota-request-max">{{ t('organization.quotaRequestMax') }}</label>
            <input
              id="quota-request-max"
              v-model.number="policyDialog.max"
              type="number"
              min="0"
              step="0.01"
              class="input w-full"
            />
          </div>
        </template>
        <p v-if="policyDialog.error" class="text-sm text-red-600 dark:text-red-400">{{ policyDialog.error }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-secondary" @click="closePolicyDialog">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn btn-primary" :disabled="policyDialog.saving">
            {{ policyDialog.saving ? t('common.submitting') : t('common.save') }}
          </button>
        </div>
      </form>
    </BaseDialog>

    <BaseDialog
      :show="rejectDialog.show"
      :title="t('organization.quotaRequestRejectTitle')"
      width="narrow"
      @close="rejectDialog.show = false"
    >
      <form class="space-y-4" @submit.prevent="submitReject">
        <p class="text-sm text-content">
          {{ rejectDialog.name || rejectDialog.email }} · {{ formatCurrency(rejectDialog.amount) }}
        </p>
        <div class="space-y-2">
          <label class="input-label" for="quota-request-reject-note">
            {{ t('organization.quotaRequestNote') }}
          </label>
          <textarea
            id="quota-request-reject-note"
            v-model="rejectDialog.note"
            rows="2"
            maxlength="500"
            class="input w-full resize-none"
          ></textarea>
        </div>
        <p v-if="rejectDialog.error" class="text-sm text-red-600 dark:text-red-400">{{ rejectDialog.error }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-secondary" @click="rejectDialog.show = false">
            {{ t('common.cancel') }}
          </button>
          <button type="submit" class="btn btn-primary" :disabled="rejectDialog.saving">
            {{ rejectDialog.saving ? t('common.submitting') : t('organization.quotaRequestReject') }}
          </button>
        </div>
      </form>
    </BaseDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Pagination from '@/components/common/Pagination.vue'
import Select, { type SelectOption } from '@/components/common/Select.vue'
import {
  approveQuotaRequest,
  getQuotaRequestPolicy,
  listQuotaRequests,
  rejectQuotaRequest,
  updateQuotaRequestPolicy
} from '@/api/organization'
import type { OrganizationQuotaRequest, OrganizationQuotaRequestPolicy } from '@/types'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatCurrency, formatDateTime } from '@/utils/format'

const emit = defineEmits<{
  (e: 'changed'): void
  (e: 'loaded', value: { mode: string; hasPending: boolean }): void
}>()

const { t } = useI18n()
const appStore = useAppStore()

const policy = ref<OrganizationQuotaRequestPolicy | null>(null)
const requests = ref<OrganizationQuotaRequest[]>([])
const requestsLoading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const statusFilter = ref('pending')
const handlingId = ref<number | null>(null)

const statusOptions = computed<SelectOption[]>(() => [
  { value: 'pending', label: t('organization.quotaRequestFilterPending') },
  { value: '', label: t('common.all') }
])

const modeOptions = computed<SelectOption[]>(() => [
  { value: 'off', label: t('organization.quotaRequestModeOff') },
  { value: 'approve', label: t('organization.quotaRequestModeApprove') },
  { value: 'auto', label: t('organization.quotaRequestModeAuto') }
])

const policyDialog = reactive({
  show: false,
  mode: 'off' as OrganizationQuotaRequestPolicy['mode'],
  min: '' as number | '',
  max: '' as number | '',
  error: '',
  saving: false
})

const rejectDialog = reactive({
  show: false,
  id: 0,
  email: '',
  name: '',
  amount: 0,
  note: '',
  error: '',
  saving: false
})

async function loadRequests(): Promise<void> {
  requestsLoading.value = true
  try {
    const result = await listQuotaRequests({
      page: page.value,
      page_size: pageSize.value,
      status: statusFilter.value || undefined
    })
    requests.value = result.items || []
    total.value = result.total
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.memberLoadFailed')))
  } finally {
    requestsLoading.value = false
  }
}

function reloadRequests(): void {
  page.value = 1
  loadRequests()
}

function handlePageChange(next: number): void {
  page.value = next
  loadRequests()
}

function handlePageSizeChange(size: number): void {
  pageSize.value = size
  page.value = 1
  loadRequests()
}

function openPolicyDialog(): void {
  policyDialog.mode = policy.value?.mode ?? 'off'
  policyDialog.min = policy.value?.min_amount ?? ''
  policyDialog.max = policy.value?.max_amount ?? ''
  policyDialog.error = ''
  policyDialog.show = true
}

function closePolicyDialog(): void {
  policyDialog.show = false
}

async function savePolicy(): Promise<void> {
  const mode = policyDialog.mode
  let min: number | null = null
  let max: number | null = null
  if (mode !== 'off') {
    min = typeof policyDialog.min === 'number' ? policyDialog.min : Number(policyDialog.min)
    max = typeof policyDialog.max === 'number' ? policyDialog.max : Number(policyDialog.max)
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
      policyDialog.error = t('organization.quotaRequestRangeInvalid')
      return
    }
  }
  policyDialog.saving = true
  policyDialog.error = ''
  try {
    policy.value = await updateQuotaRequestPolicy(mode, min, max)
    policyDialog.show = false
    appStore.showSuccess(t('common.saved'))
  } catch (error) {
    policyDialog.error = extractApiErrorMessage(error, t('organization.memberUpdateFailed'))
  } finally {
    policyDialog.saving = false
  }
}

async function approve(request: OrganizationQuotaRequest): Promise<void> {
  handlingId.value = request.id
  try {
    await approveQuotaRequest(request.id)
    appStore.showSuccess(t('organization.quotaRequestApproved'))
    await loadRequests()
    emit('changed')
  } catch (error) {
    // 成员此刻不能加时申请会自动作废，这里同时刷新列表让结果可见。
    appStore.showError(extractApiErrorMessage(error, t('organization.memberUpdateFailed')))
    await loadRequests()
  } finally {
    handlingId.value = null
  }
}

function openReject(request: OrganizationQuotaRequest): void {
  rejectDialog.id = request.id
  rejectDialog.email = request.email
  rejectDialog.name = request.display_name || request.email
  rejectDialog.amount = request.amount
  rejectDialog.note = ''
  rejectDialog.error = ''
  rejectDialog.show = true
}

async function submitReject(): Promise<void> {
  rejectDialog.saving = true
  rejectDialog.error = ''
  try {
    await rejectQuotaRequest(rejectDialog.id, rejectDialog.note.trim() || undefined)
    rejectDialog.show = false
    await loadRequests()
  } catch (error) {
    rejectDialog.error = extractApiErrorMessage(error, t('organization.memberUpdateFailed'))
  } finally {
    rejectDialog.saving = false
  }
}

function statusClass(status: OrganizationQuotaRequest['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
    case 'granted':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
    default:
      return 'bg-gray-100 text-content-muted dark:bg-dark-700 dark:text-dark-300'
  }
}

// 先批后加且有待处理时，组织页把这一块挪到成员表上面，避免漏批。
const summary = computed(() => ({
  mode: policy.value?.mode ?? 'off',
  hasPending: requests.value.some((request) => request.status === 'pending')
}))
watchEffect(() => {
  emit('loaded', summary.value)
})

onMounted(() => {
  getQuotaRequestPolicy()
    .then((loaded) => {
      policy.value = loaded
    })
    .catch(() => {
      // 策略拿不到时保持 null，列表照常展示。
    })
  loadRequests()
})
</script>
