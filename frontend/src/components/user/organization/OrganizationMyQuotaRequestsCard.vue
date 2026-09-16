<template>
  <section class="card overflow-hidden">
    <div class="border-b border-gray-200 px-5 py-4 dark:border-dark-700">
      <h2 class="text-base font-semibold text-content-strong">
        {{ t('organization.quotaRequestMy') }}
      </h2>
    </div>

    <div v-if="loading" class="flex justify-center py-10">
      <div class="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
    </div>

    <div v-else-if="requests.length === 0" class="px-5 py-10 text-center text-sm text-content-muted">
      {{ t('organization.quotaRequestEmpty') }}
    </div>

    <ul v-else class="divide-y divide-line-subtle">
      <li v-for="request in requests" :key="request.id" class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span class="font-mono font-medium text-content-strong">${{ formatCurrency(request.amount) }}</span>
            <span
              :class="statusClass(request.status)"
              class="rounded-full px-2 py-0.5 text-xs"
            >
              {{ t(`organization.quotaRequestStatus.${request.status}`) }}
            </span>
          </div>
          <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-muted">
            <span v-if="request.reason">{{ request.reason }}</span>
            <span>{{ formatDateTime(request.created_at) }}</span>
            <span v-if="request.review_note" class="text-content-subtle">{{ request.review_note }}</span>
          </div>
        </div>
        <button
          v-if="request.status === 'pending'"
          type="button"
          class="btn btn-secondary btn-sm shrink-0"
          :disabled="withdrawingId === request.id"
          @click="withdraw(request)"
        >
          {{ t('organization.quotaRequestWithdraw') }}
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listQuotaRequests, withdrawQuotaRequest } from '@/api/organization'
import type { OrganizationQuotaRequest } from '@/types'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatCurrency, formatDateTime } from '@/utils/format'

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const { t } = useI18n()
const appStore = useAppStore()

const requests = ref<OrganizationQuotaRequest[]>([])
const loading = ref(true)
const withdrawingId = ref<number | null>(null)

async function load(): Promise<void> {
  loading.value = true
  try {
    // 服务端按身份分流：普通成员只拿得到自己的申请。
    const result = await listQuotaRequests({ page: 1, page_size: 10 })
    requests.value = result.items || []
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.memberLoadFailed')))
  } finally {
    loading.value = false
  }
}

async function withdraw(request: OrganizationQuotaRequest): Promise<void> {
  withdrawingId.value = request.id
  try {
    await withdrawQuotaRequest(request.id)
    await load()
    emit('changed')
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.memberUpdateFailed')))
  } finally {
    withdrawingId.value = null
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

onMounted(load)

defineExpose({ reload: load })
</script>
