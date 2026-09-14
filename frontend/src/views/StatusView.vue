<template>
  <div class="lp">
    <LandingNav current="status" />

    <main class="st-main">
      <div class="lp-shell">
        <!-- 顶部汇总：访客先看这两个数 -->
        <div class="st-summary">
          <div class="st-sum-card">
            <p class="st-sum-label">{{ t('status.summary.availability', { days: windowDays }) }}</p>
            <p class="st-sum-value">
              <template v-if="hasData">
                {{ data.availability_7d.toFixed(2) }}<span class="st-sum-unit">%</span>
              </template>
              <template v-else>—</template>
            </p>
          </div>
          <div class="st-sum-card">
            <p class="st-sum-label">{{ t('status.summary.monitors') }}</p>
            <p class="st-sum-value">
              <template v-if="hasData">
                {{ data.operational_count }}<span class="st-sum-sep"> / </span>{{ data.total_count }}
              </template>
              <template v-else>—</template>
            </p>
          </div>
        </div>

        <div v-if="loading" class="st-empty">{{ t('status.loading') }}</div>
        <div v-else-if="unavailable" class="st-empty">{{ t('status.unavailable') }}</div>
        <div v-else-if="!components.length" class="st-empty">{{ t('status.noMonitors') }}</div>

        <!-- 每个监测项一张卡 -->
        <template v-else>
          <article v-for="item in components" :key="item.name" class="st-card">
            <div class="st-card-head">
              <div class="st-ident">
                <span class="st-dot" :class="`is-${item.status}`" aria-hidden="true"></span>
                <span class="st-name">{{ item.name }}</span>
                <span class="st-badge" :class="`is-${item.status}`">
                  {{ t(`status.level.${item.status}`) }}
                </span>
                <span v-if="item.api_mode" class="st-tag">{{ item.api_mode }}</span>
                <span v-if="item.group_name" class="st-tag">{{ item.group_name }}</span>
              </div>

              <dl class="st-metrics">
                <div class="st-metric">
                  <dt>{{ t('status.metric.availability') }}</dt>
                  <dd>{{ item.availability_7d > 0 ? `${item.availability_7d.toFixed(2)}%` : '—' }}</dd>
                </div>
                <div class="st-metric">
                  <dt>{{ t('status.metric.ping') }}</dt>
                  <dd>{{ item.ping_latency_ms !== null ? `${item.ping_latency_ms} ms` : '—' }}</dd>
                </div>
                <div class="st-metric">
                  <dt>{{ t('status.metric.latency') }}</dt>
                  <dd>{{ item.latency_ms !== null ? `${item.latency_ms} ms` : '—' }}</dd>
                </div>
              </dl>
            </div>

            <!-- 状态条：一格一次探测，从左到右按时间 -->
            <div class="st-bar" role="img" :aria-label="barLabel(item)">
              <span
                v-for="(point, index) in item.timeline"
                :key="index"
                class="st-tick"
                :class="`is-${point.status}`"
                :title="`${formatPoint(point.checked_at)} · ${t(`status.level.${point.status}`)}`"
              ></span>
            </div>
          </article>

          <p class="st-foot">
            {{ t('status.updatedAt', { time: formatTime(data.updated_at) }) }}
            <span class="st-foot-sep">·</span>
            {{ t('status.window', { days: windowDays }) }}
          </p>
          <p class="st-note">{{ t('status.note') }}</p>
        </template>
      </div>
    </main>

    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LandingNav from './landing/LandingNav.vue'
import LandingFooter from './landing/LandingFooter.vue'
import { getServiceStatus, type ServiceStatus, type ServiceStatusComponent } from '@/api/status'
import { useAppStore } from '@/stores'
import './landing/landing.css'

/**
 * 对外服务状态页。
 *
 * 数据是管理员在后台配置的渠道监测跑出来的，状态、延迟、可用率和时间线
 * 都由后端算好，这里只负责画。上游厂商、模型名和配额快照后端不返回。
 */
const { t, locale } = useI18n()
const appStore = useAppStore()

const data = ref<ServiceStatus>({
  status: 'unknown',
  updated_at: '',
  window_days: 7,
  availability_7d: 0,
  operational_count: 0,
  total_count: 0,
  components: []
})
const loading = ref(true)
const unavailable = ref(false)

const hasData = computed(() => !loading.value && !unavailable.value && data.value.total_count > 0)
const components = computed<ServiceStatusComponent[]>(() => data.value.components)
const windowDays = computed(() => data.value.window_days || 7)

const formatTime = (value: string): string => {
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return value
  return at.toLocaleString(locale.value === 'en' ? 'en-US' : 'zh-CN')
}

const formatPoint = (value: string): string => {
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return value
  return at.toLocaleString(locale.value === 'en' ? 'en-US' : 'zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const barLabel = (item: ServiceStatusComponent): string =>
  t('status.barLabel', { name: item.name, days: windowDays.value })

onMounted(async () => {
  void appStore.fetchPublicSettings()
  try {
    data.value = await getServiceStatus()
  } catch {
    // 开关关闭时后端返回 404，和请求失败一起按「暂不可用」处理
    unavailable.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.st-main {
  flex: 1;
  padding: 32px 0 64px;
  background: var(--sunken);
}

/* ══════ 顶部汇总 ══════ */
.st-summary {
  display: grid;
  gap: 16px;
  margin-bottom: 20px;
}

.st-sum-card {
  padding: 20px 24px 22px;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper);
}

.st-sum-label {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--muted);
}

.st-sum-value {
  margin: 10px 0 0;
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.st-sum-unit {
  font-size: 1.25rem;
  font-weight: 600;
}

.st-sum-sep {
  font-weight: 400;
  color: var(--subtle);
}

@media (min-width: 760px) {
  .st-summary {
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  }
}

/* ══════ 监测项卡片 ══════ */
.st-card {
  margin-bottom: 12px;
  padding: 18px 24px 22px;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper);
}

.st-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: 14px;
}

.st-ident {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.st-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #b6bcc6;
}

.st-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ink);
}

.st-badge {
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--sunken);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted);
}

.st-tag {
  padding: 2px 8px;
  border: 1px solid var(--rule);
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.6875rem;
  color: var(--muted);
}

/* ── 状态配色：圆点、徽章、格子三处共用 ── */
.is-operational.st-dot {
  background: #16a34a;
}

.is-degraded.st-dot {
  background: #f59e0b;
}

.is-outage.st-dot {
  background: #ef4444;
}

.is-operational.st-badge {
  background: #dcfce7;
  color: #15803d;
}

.is-degraded.st-badge {
  background: #fef3c7;
  color: #b45309;
}

.is-outage.st-badge {
  background: #fee2e2;
  color: #b91c1c;
}

.dark .is-operational.st-badge {
  background: rgba(22, 163, 74, 0.16);
  color: #4ade80;
}

.dark .is-degraded.st-badge {
  background: rgba(245, 158, 11, 0.16);
  color: #fbbf24;
}

.dark .is-outage.st-badge {
  background: rgba(239, 68, 68, 0.16);
  color: #f87171;
}

/* ══════ 右侧指标 ══════ */
.st-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 22px;
  margin: 0;
}

.st-metric {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.st-metric dt {
  font-size: 0.75rem;
  color: var(--subtle);
}

.st-metric dd {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

/* ══════ 状态条 ══════ */
/* 竖长条用固定宽度，多出来的换行。
   等分铺满会把格子压成细丝，颜色就看不出来了。 */
.st-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.st-tick {
  width: 9px;
  height: 28px;
  border-radius: 2px;
  background: #d8dde5;
}

.st-tick.is-operational {
  background: #16a34a;
}

.st-tick.is-degraded {
  background: #f59e0b;
}

.st-tick.is-outage {
  background: #ef4444;
}

.dark .st-tick {
  background: #2e333b;
}

@media (max-width: 600px) {
  .st-tick {
    width: 7px;
    height: 24px;
  }
}

/* ══════ 页脚说明 ══════ */
.st-foot,
.st-note,
.st-empty {
  font-size: 0.8125rem;
  line-height: 1.8;
  color: var(--muted);
}

.st-foot {
  margin: 18px 0 0;
}

.st-foot-sep {
  margin: 0 6px;
  color: var(--subtle);
}

.st-note {
  margin: 6px 0 0;
  color: var(--subtle);
}

.st-empty {
  padding: 48px 0;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper);
  text-align: center;
}
</style>
