<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <h1 class="truncate text-lg font-semibold text-content-strong">{{ t('securityProtection.title') }}</h1>
          <p class="mt-1 text-sm text-content-muted">{{ t('securityProtection.subtitle') }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <div v-if="isAdmin" class="w-52">
            <Select v-model="selectedOrgId" :options="orgOptions" :placeholder="t('securityProtection.selectOrg')" />
          </div>
          <div class="w-32">
            <Select v-model="range" :options="rangeOptions" />
          </div>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-16" aria-live="polite">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
      </div>

      <div v-else-if="state === 'forbidden'" class="card p-8 text-center text-sm text-content-muted">
        {{ t('securityProtection.forbidden') }}
      </div>
      <div v-else-if="state === 'unavailable'" class="card p-8 text-center">
        <p class="text-sm text-content-muted">{{ t('securityProtection.unavailable') }}</p>
        <button type="button" class="btn btn-secondary btn-sm mt-4" @click="load">
          {{ t('common.refresh') }}
        </button>
      </div>
      <div v-else-if="state === 'empty'" class="card p-12 text-center text-sm text-content-muted">
        {{ t('securityProtection.noData') }}
      </div>

      <template v-else-if="summary">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="kpi in kpis" :key="kpi.key" class="card relative overflow-hidden p-4">
            <span aria-hidden class="absolute bottom-0 left-0 top-0 w-[3px]" :style="{ background: kpi.color }" />
            <div class="text-[11px] font-semibold uppercase tracking-wider text-content-muted">{{ kpi.label }}</div>
            <div class="mt-2 text-3xl font-semibold leading-none text-content-strong">{{ formatNumber(kpi.value) }}</div>
            <div class="mt-2 text-xs text-content-muted">{{ kpi.caption }}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div class="card p-4">
            <h3 class="mb-4 text-sm font-semibold text-content-strong">{{ t('securityProtection.trendTitle') }}</h3>
            <div v-if="trendData" class="h-64"><Line :data="trendData" :options="lineOptions" /></div>
            <div v-else class="flex h-64 items-center justify-center text-sm text-content-muted">{{ t('securityProtection.noData') }}</div>
          </div>
          <div class="card p-4">
            <h3 class="mb-4 text-sm font-semibold text-content-strong">{{ t('securityProtection.outcomeTitle') }}</h3>
            <div v-if="outcomeData" class="mx-auto h-64 w-64"><Doughnut :data="outcomeData" :options="doughnutOptions" /></div>
            <div v-else class="flex h-64 items-center justify-center text-sm text-content-muted">{{ t('securityProtection.noData') }}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div class="card p-4">
            <h3 class="mb-4 text-sm font-semibold text-content-strong">{{ t('securityProtection.riskTypeTitle') }}</h3>
            <div v-if="riskTypeData" class="h-64"><Bar :data="riskTypeData" :options="barOptions" /></div>
            <div v-else class="flex h-64 items-center justify-center text-sm text-content-muted">{{ t('securityProtection.noData') }}</div>
          </div>
          <div class="card p-4">
            <h3 class="mb-4 text-sm font-semibold text-content-strong">{{ t('securityProtection.topActorTitle') }}</h3>
            <div v-if="topActorData" class="h-64"><Bar :data="topActorData" :options="topActorOptions" /></div>
            <div v-else class="flex h-64 items-center justify-center text-sm text-content-muted">{{ t('securityProtection.noData') }}</div>
          </div>
        </div>

        <div class="card p-4">
          <h3 class="mb-4 text-sm font-semibold text-content-strong">{{ t('securityProtection.recentTitle') }}</h3>
          <div v-if="recentEvents.length" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-content-muted">
                  <th class="pb-2 text-left">{{ t('securityProtection.colTime') }}</th>
                  <th class="pb-2 text-left">{{ t('securityProtection.colUser') }}</th>
                  <th class="pb-2 text-left">{{ t('securityProtection.colType') }}</th>
                  <th class="pb-2 text-left">{{ t('securityProtection.colAction') }}</th>
                  <th class="pb-2 text-left">{{ t('securityProtection.colValue') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="event in recentEvents" :key="event.id" class="border-t border-line-subtle">
                  <td class="py-2 text-content-muted">{{ formatTime(event.created_at) }}</td>
                  <td class="max-w-[160px] truncate py-2 text-content-strong" :title="event.user_name || event.external_user_id">
                    {{ event.user_name || event.external_user_id }}
                  </td>
                  <td class="py-2 text-content">{{ capabilityLabel(event.capability) }}</td>
                  <td class="py-2">
                    <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :style="actionBadgeStyle(event.action)">
                      {{ actionLabel(event.action) }}
                    </span>
                  </td>
                  <td class="max-w-[220px] truncate py-2 font-mono text-xs text-content-muted" :title="event.masked_value">
                    {{ event.masked_value || '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="py-8 text-center text-sm text-content-muted">{{ t('securityProtection.noData') }}</div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import AppLayout from '@/components/layout/AppLayout.vue'
import Select from '@/components/common/Select.vue'
import { useAuthStore } from '@/stores/auth'
import { list as listAdminOrganizations } from '@/api/admin/organizations'
import {
  getACFPluginRecentEvents,
  getACFPluginRiskTypes,
  getACFPluginSummary,
  getACFPluginTopActors,
  getACFPluginTrend,
  type ACFPluginRecentEvent,
  type ACFPluginRiskType,
  type ACFPluginSummary,
  type ACFPluginTopActor,
  type ACFPluginTrend,
} from '@/api/acfPlugin'

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)

const HTTP_FORBIDDEN = 403
const HTTP_BAD_GATEWAY = 502

const { t } = useI18n()
const authStore = useAuthStore()
const isAdmin = computed(() => authStore.isAdmin === true)
const isOwner = computed(() => authStore.user?.organization?.is_owner === true)
const canView = computed(() => isAdmin.value || isOwner.value)

type PageState = 'loading' | 'ready' | 'empty' | 'unavailable' | 'forbidden'
const state = ref<PageState>('loading')
const loading = ref(true)
const range = ref('7d')
const selectedOrgId = ref<number | null>(null)
const orgOptions = ref<{ value: number; label: string }[]>([])

const summary = ref<ACFPluginSummary | null>(null)
const trend = ref<ACFPluginTrend | null>(null)
const riskTypes = ref<ACFPluginRiskType[]>([])
const topActors = ref<ACFPluginTopActor[]>([])
const recentEvents = ref<ACFPluginRecentEvent[]>([])

const rangeOptions = computed(() => [
  { value: '7d', label: t('securityProtection.range7d') },
  { value: '30d', label: t('securityProtection.range30d') },
  { value: '90d', label: t('securityProtection.range90d') },
])

const windowRange = computed(() => {
  const days = range.value === '7d' ? 7 : range.value === '90d' ? 90 : 30
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
})

const OUTCOME_COLORS: Record<string, string> = {
  blocked: '#dc2626',
  redacted: '#d97706',
  observed: '#2563eb',
}

const outcomeMeta = computed<Record<string, { label: string; color: string }>>(() => ({
  blocked: { label: t('securityProtection.outcomeBlocked'), color: OUTCOME_COLORS.blocked },
  redacted: { label: t('securityProtection.outcomeRedacted'), color: OUTCOME_COLORS.redacted },
  observed: { label: t('securityProtection.outcomeObserved'), color: OUTCOME_COLORS.observed },
}))

const capabilityLabels = computed<Record<string, string>>(() => ({
  secrets: t('securityProtection.capabilitySecrets'),
  credential: t('securityProtection.capabilityCredential'),
  pii: t('securityProtection.capabilityPii'),
  dict: t('securityProtection.capabilityDict'),
  keyword: t('securityProtection.capabilityKeyword'),
  code_egress: t('securityProtection.capabilityCodeEgress'),
  sourcecode: t('securityProtection.capabilitySourcecode'),
  guard_attack: t('securityProtection.capabilityGuardAttack'),
  guard_content: t('securityProtection.capabilityGuardContent'),
  output_safety: t('securityProtection.capabilityOutputSafety'),
}))

const kpis = computed(() => {
  if (!summary.value) return []
  return [
    { key: 'requests', label: t('securityProtection.kpiRequests'), value: summary.value.requests, caption: t('securityProtection.kpiRequestsCaption'), color: '#2563eb' },
    { key: 'detections', label: t('securityProtection.kpiDetections'), value: summary.value.detections, caption: t('securityProtection.kpiDetectionsCaption'), color: '#64748b' },
    { key: 'risks', label: t('securityProtection.kpiRisks'), value: summary.value.risks, caption: t('securityProtection.kpiRisksCaption'), color: '#dc2626' },
    { key: 'gap', label: t('securityProtection.kpiGap'), value: summary.value.gapRequests, caption: t('securityProtection.kpiGapCaption'), color: '#d97706' },
  ]
})

const outcomeData = computed(() => {
  const entries = Object.entries(summary.value?.byOutcome ?? {}).filter(([, v]) => v > 0)
  if (!entries.length) return null
  return {
    labels: entries.map(([k]) => outcomeMeta.value[k]?.label ?? k),
    datasets: [{
      data: entries.map(([, v]) => v),
      backgroundColor: entries.map(([k]) => outcomeMeta.value[k]?.color ?? '#94a3b8'),
      borderWidth: 0,
    }],
  }
})

const riskTypeData = computed(() => {
  if (!riskTypes.value.length) return null
  return {
    labels: riskTypes.value.map((r) => capabilityLabels.value[r.risk_type] ?? r.risk_type),
    datasets: [{
      label: t('securityProtection.riskCount'),
      data: riskTypes.value.map((r) => r.count),
      backgroundColor: '#d97706',
      borderRadius: 4,
      maxBarThickness: 40,
    }],
  }
})

const topActorData = computed(() => {
  if (!topActors.value.length) return null
  return {
    labels: topActors.value.map((a) => a.user_name || a.external_user_id),
    datasets: [{
      label: t('securityProtection.riskCount'),
      data: topActors.value.map((a) => a.risks),
      backgroundColor: '#2563eb',
      borderRadius: 4,
      maxBarThickness: 24,
    }],
  }
})

const trendData = computed(() => {
  const timeline = trend.value?.timeline ?? []
  if (!timeline.length) return null
  return {
    labels: timeline.map((p) => formatTrendLabel(p.ts)),
    datasets: [
      {
        label: t('securityProtection.legendEvents'),
        data: timeline.map((p) => p.events),
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220,38,38,0.08)',
        tension: 0.3,
        fill: true,
        pointRadius: 0,
      },
      {
        label: t('securityProtection.legendBlocked'),
        data: timeline.map((p) => p.blocked),
        borderColor: '#d97706',
        backgroundColor: 'rgba(217,119,6,0.08)',
        tension: 0.3,
        fill: true,
        pointRadius: 0,
      },
    ],
  }
})

const doughnutOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const } } }
const lineOptions = { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index' as const, intersect: false } }
const barOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
const topActorOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  plugins: { legend: { display: false } },
}

function formatTrendLabel(ts: string): string {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ts
  return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
}

function formatNumber(value: number): string {
  return Number(value ?? 0).toLocaleString()
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function capabilityLabel(capability: string): string {
  return capabilityLabels.value[capability] ?? capability
}

function actionLabel(action: string): string {
  return outcomeMeta.value[action]?.label ?? action
}

function actionBadgeStyle(action: string) {
  const color = outcomeMeta.value[action]?.color ?? '#64748b'
  return { color, backgroundColor: `${color}1a` }
}

async function load() {
  if (!canView.value) {
    state.value = 'forbidden'
    loading.value = false
    return
  }
  loading.value = true
  state.value = 'loading'
  const query = {
    from: windowRange.value.from,
    to: windowRange.value.to,
    ...(isAdmin.value && selectedOrgId.value ? { org_id: selectedOrgId.value } : {}),
  }
  try {
    const [summaryRes, trendRes, typesRes, actorsRes, eventsRes] = await Promise.allSettled([
      getACFPluginSummary(query),
      getACFPluginTrend(query),
      getACFPluginRiskTypes(query),
      getACFPluginTopActors(query),
      getACFPluginRecentEvents(query),
    ])
    if (summaryRes.status === 'rejected') {
      const errStatus = (summaryRes.reason as { status?: number } | undefined)?.status
      if (errStatus === HTTP_FORBIDDEN) {
        state.value = 'forbidden'
      } else if (errStatus === HTTP_BAD_GATEWAY) {
        state.value = 'unavailable'
      } else {
        state.value = 'empty'
      }
      return
    }
    summary.value = summaryRes.status === 'fulfilled' ? summaryRes.value : null
    trend.value = trendRes.status === 'fulfilled' ? trendRes.value : null
    riskTypes.value = typesRes.status === 'fulfilled' ? typesRes.value : []
    topActors.value = actorsRes.status === 'fulfilled' ? actorsRes.value : []
    recentEvents.value = eventsRes.status === 'fulfilled' ? eventsRes.value : []

    const hasAny = !!summary.value && (summary.value.requests > 0 || summary.value.detections > 0 || summary.value.risks > 0)
    state.value = hasAny ? 'ready' : 'empty'
  } finally {
    loading.value = false
  }
}

async function loadOrgOptions() {
  try {
    const result = await listAdminOrganizations(1, 200)
    orgOptions.value = (result.items ?? []).map((org) => ({ value: org.id, label: org.name }))
    if (orgOptions.value.length) {
      selectedOrgId.value = orgOptions.value[0].value
    }
  } catch {
    orgOptions.value = []
  }
}

onMounted(async () => {
  if (isAdmin.value) {
    await loadOrgOptions()
  }
  await load()
})

watch(range, () => load())
watch(selectedOrgId, () => {
  if (isAdmin.value) load()
})
</script>
