<template>
  <div class="card p-4">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('usage.memberDistribution') }}
      </h3>
      <div
        v-if="showMetricToggle"
        class="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-dark-700 dark:bg-dark-800"
      >
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          :class="metric === 'tokens'
            ? 'bg-white text-gray-900 shadow-sm dark:bg-dark-700 dark:text-white'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
          @click="emit('update:metric', 'tokens')"
        >
          {{ t('admin.dashboard.metricTokens') }}
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
          :class="metric === 'actual_cost'
            ? 'bg-white text-gray-900 shadow-sm dark:bg-dark-700 dark:text-white'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
          @click="emit('update:metric', 'actual_cost')"
        >
          {{ t('admin.dashboard.metricActualCost') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex h-48 items-center justify-center">
      <LoadingSpinner />
    </div>
    <div v-else-if="displayMembers.length > 0 && chartData" class="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div class="h-48 w-48 shrink-0">
        <Doughnut :data="chartData" :options="doughnutOptions" />
      </div>
      <div class="max-h-48 w-full min-w-0 flex-1 overflow-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-500 dark:text-gray-400">
              <th class="pb-2 text-left">{{ t('usage.member') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.requests') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.tokens') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.actual') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="member in displayMembers"
              :key="member.user_id"
              class="border-t border-gray-100 dark:border-dark-700"
            >
              <td
                class="max-w-[140px] truncate py-1.5 font-medium text-gray-900 dark:text-white"
                :title="memberLabel(member)"
              >
                {{ memberLabel(member) }}
              </td>
              <td class="py-1.5 text-right text-gray-600 dark:text-gray-400">{{ formatNumber(member.requests) }}</td>
              <td class="py-1.5 text-right text-gray-600 dark:text-gray-400">{{ formatTokens(member.total_tokens) }}</td>
              <td class="py-1.5 text-right text-green-600 dark:text-green-400">${{ formatCost(member.actual_cost) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('admin.dashboard.noDataAvailable') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { CHART_COLORS } from '@/constants/chartColors'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { OrganizationMemberUsageStat } from '@/types'

ChartJS.register(ArcElement, Tooltip, Legend)

const { t } = useI18n()

type DistributionMetric = 'tokens' | 'actual_cost'

const props = withDefaults(defineProps<{
  members: OrganizationMemberUsageStat[]
  loading?: boolean
  metric?: DistributionMetric
  showMetricToggle?: boolean
}>(), {
  loading: false,
  metric: 'tokens',
  showMetricToggle: true
})

const emit = defineEmits<{
  'update:metric': [value: DistributionMetric]
}>()

const chartColors = CHART_COLORS

const memberLabel = (member: OrganizationMemberUsageStat): string =>
  member.username || member.email || String(member.user_id)

const displayMembers = computed(() => {
  if (!props.members?.length) return []
  const metricKey = props.metric === 'actual_cost' ? 'actual_cost' : 'total_tokens'
  return [...props.members].sort((a, b) => toFiniteNumber(b[metricKey]) - toFiniteNumber(a[metricKey]))
})

const chartData = computed(() => {
  if (!displayMembers.value.length) return null
  return {
    labels: displayMembers.value.map(memberLabel),
    datasets: [
      {
        data: displayMembers.value.map((m) =>
          toFiniteNumber(props.metric === 'actual_cost' ? m.actual_cost : m.total_tokens)
        ),
        backgroundColor: chartColors.slice(0, displayMembers.value.length),
        borderWidth: 0
      }
    ]
  }
})

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const value = context.raw as number
          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
          const formattedValue = props.metric === 'actual_cost' ? `$${formatCost(value)}` : formatTokens(value)
          return `${context.label}: ${formattedValue} (${percentage}%)`
        }
      }
    }
  }
}))

const formatTokens = (value: number): string => {
  const safeValue = toFiniteNumber(value)
  if (safeValue >= 1_000_000_000) return `${(safeValue / 1_000_000_000).toFixed(2)}B`
  if (safeValue >= 1_000_000) return `${(safeValue / 1_000_000).toFixed(2)}M`
  if (safeValue >= 1_000) return `${(safeValue / 1_000).toFixed(2)}K`
  return safeValue.toLocaleString()
}

const formatNumber = (value: number): string => toFiniteNumber(value).toLocaleString()

const toFiniteNumber = (value: unknown): number => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const formatCost = (value: number | null | undefined): string => {
  const safeValue = toFiniteNumber(value)
  if (safeValue >= 1000) return (safeValue / 1000).toFixed(2) + 'K'
  if (safeValue >= 1) return safeValue.toFixed(2)
  if (safeValue >= 0.01) return safeValue.toFixed(3)
  return safeValue.toFixed(4)
}
</script>
