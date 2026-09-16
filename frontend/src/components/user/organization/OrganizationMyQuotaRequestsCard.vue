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

    <div v-else-if="loadError" class="empty-state px-5 py-10">
      <p class="empty-state-title">{{ t('organization.memberLoadFailed') }}</p>
      <button type="button" class="btn btn-secondary btn-sm mt-3" @click="reload">
        {{ t('common.retry') }}
      </button>
    </div>

    <div v-else-if="requests.length === 0" class="empty-state px-5 py-10">
      <p class="empty-state-title">{{ t('organization.quotaRequestEmpty') }}</p>
    </div>

    <template v-else>
      <ul class="divide-y divide-line-subtle">
        <li v-for="request in requests" :key="request.id" class="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span class="font-mono font-medium text-content-strong">{{ formatCurrency(request.amount) }}</span>
              <span
                :class="statusClass(request.status)"
                class="rounded-full px-2 py-0.5 text-xs"
              >
                {{ t(`organization.quotaRequestStatus.${request.status}`) }}
              </span>
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-muted">
              <span v-if="request.reason" class="min-w-0 max-w-[16rem] truncate" :title="request.reason">
                {{ request.reason }}
              </span>
              <span>{{ formatDateTime(request.created_at) }}</span>
              <span
                v-if="request.review_note"
                class="min-w-0 max-w-[12rem] truncate text-content-subtle"
                :title="request.review_note"
              >
                {{ request.review_note }}
              </span>
            </div>
          </div>
          <TableActionButton
            v-if="request.status === 'pending'"
            icon="x"
            :label="t('organization.quotaRequestWithdraw')"
            class="shrink-0"
            :disabled="withdrawingId === request.id"
            @click="withdraw(request)"
          />
        </li>
      </ul>
      <div v-if="requests.length < total" class="border-t border-line-subtle px-5 py-3 text-center">
        <button type="button" class="btn btn-secondary btn-sm" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? t('common.loading') : t('common.loadMore') }}
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import TableActionButton from '@/components/common/TableActionButton.vue'
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
const total = ref(0)
const loading = ref(true)
const loadingMore = ref(false)
const loadError = ref(false)
const withdrawingId = ref<number | null>(null)

// 服务端按身份分流：普通成员只拿得到自己的申请。
async function load(): Promise<void> {
  loading.value = true
  loadError.value = false
  try {
    const result = await listQuotaRequests({ page: 1, page_size: 10 })
    requests.value = result.items || []
    total.value = result.total
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

// 加载更多：追加下一页，已展示的记录原地不动。
async function loadMore(): Promise<void> {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    const nextPage = Math.floor(requests.value.length / 10) + 1
    const result = await listQuotaRequests({ page: nextPage, page_size: 10 })
    const known = new Set(requests.value.map((request) => request.id))
    for (const request of result.items || []) {
      if (!known.has(request.id)) requests.value.push(request)
    }
    total.value = result.total
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.memberLoadFailed')))
  } finally {
    loadingMore.value = false
  }
}

function reload(): void {
  void load()
}

async function withdraw(request: OrganizationQuotaRequest): Promise<void> {
  withdrawingId.value = request.id
  try {
    await withdrawQuotaRequest(request.id)
    appStore.showSuccess(t('organization.quotaRequestWithdrawn'))
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
