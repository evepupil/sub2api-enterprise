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
          ${{ formatCurrency(overview.remaining) }}
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
        data-tour="org-quota-apply"
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
    </BaseDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import { submitQuotaRequest } from '@/api/organization'
import type { UserOrganizationQuotaOverview } from '@/types'
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

function openDialog(): void {
  dialog.amount = props.overview.min_amount ?? ''
  dialog.reason = ''
  dialog.error = ''
  dialog.show = true
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
    dialog.show = false
    appStore.showSuccess(t('dashboard.orgQuotaSubmitted'))
    emit('applied')
  } catch (error) {
    dialog.error = extractApiErrorMessage(error, t('dashboard.orgQuotaSubmitFailed'))
  } finally {
    dialog.saving = false
  }
}
</script>
