<template>
  <div class="hc" role="img" :aria-label="t('landing.console.caption')">
    <!-- 顶条：谁在看、看哪段 -->
    <div class="hc-bar">
      <span class="hc-live">
        <span class="hc-dot" aria-hidden="true"></span>
        {{ t('landing.console.org') }}
      </span>
      <span class="hc-range">{{ t('landing.console.range') }}</span>
    </div>

    <!-- 三个关键数 -->
    <div class="hc-metrics">
      <div v-for="metric in metrics" :key="metric.key" class="hc-metric">
        <div class="hc-metric-label">{{ metric.label }}</div>
        <div class="hc-metric-value">
          {{ metric.value }}<span v-if="metric.unit" class="hc-metric-unit">{{ metric.unit }}</span>
        </div>
        <div class="hc-metric-note" :class="metric.tone">{{ metric.note }}</div>
      </div>
    </div>

    <!-- 趋势 -->
    <div class="hc-chart">
      <div class="hc-chart-head">
        <span class="hc-chart-label">{{ t('landing.console.trend') }}</span>
        <span class="hc-chart-figure">
          186,420<span class="hc-delta">+24%</span>
        </span>
      </div>
      <svg class="hc-svg" viewBox="0 0 280 64" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="hc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#5080e2" stop-opacity="0.28" />
            <stop offset="100%" stop-color="#5080e2" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="areaPath" fill="url(#hc-fill)" />
        <path :d="linePath" fill="none" stroke="#7fa4ef" stroke-width="1.5" stroke-linejoin="round" />
        <circle :cx="lastPoint.x" :cy="lastPoint.y" r="2.5" fill="#7fa4ef" />
      </svg>
    </div>

    <!-- 流水：每一行是一次调用 -->
    <div class="hc-log">
      <div class="hc-log-head" aria-hidden="true">
        <span>{{ t('landing.console.col.member') }}</span>
        <span>{{ t('landing.console.col.group') }}</span>
        <span class="hc-right">{{ t('landing.console.col.tokens') }}</span>
        <span class="hc-right">{{ t('landing.console.col.cost') }}</span>
      </div>
      <ul class="hc-rows">
        <li v-for="row in rows" :key="row.id" class="hc-row" :class="{ 'is-new': row.id === newestId }">
          <span class="hc-member">{{ row.member }}</span>
          <span class="hc-group">{{ row.group }}</span>
          <span class="hc-right hc-dim">{{ row.tokens }}</span>
          <span class="hc-right hc-cost">{{ row.cost }}</span>
        </li>
      </ul>
    </div>

    <!-- 底条：状态和授权范围 -->
    <div class="hc-foot">
      <span class="hc-chip is-ok">
        <span class="hc-dot hc-dot-static" aria-hidden="true"></span>
        {{ t('landing.console.healthy') }}
      </span>
      <span class="hc-chip">{{ groupChips }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 首屏那块控制台示意。
 *
 * 示意数据，不是实测。它要一眼说清三件事：钱算得清、量看得见、
 * 每一次调用落在谁头上。列就是控制台里真实存在的那几列。
 * 不出现任何上游厂商和型号名，分组名走文案。
 */
const { t } = useI18n()

const metrics = computed(() => [
  {
    key: 'spend',
    label: t('landing.console.metric.spend'),
    value: '$1,284',
    unit: '.50',
    note: t('landing.console.metric.spendNote'),
    tone: 'is-up'
  },
  {
    key: 'calls',
    label: t('landing.console.metric.calls'),
    value: '186,420',
    unit: '',
    note: t('landing.console.metric.callsNote'),
    tone: ''
  },
  {
    key: 'members',
    label: t('landing.console.metric.members'),
    value: '24',
    unit: '',
    note: t('landing.console.metric.membersNote'),
    tone: ''
  }
])

const groupChips = computed(() =>
  [
    t('landing.console.group.default'),
    t('landing.console.group.enterprise'),
    t('landing.console.group.image')
  ].join(' · ')
)

// ── 趋势线 ──────────────────────────────────────────────
const SERIES = [34, 41, 38, 49, 45, 56, 52, 63, 59, 70, 66, 77, 72, 88]
const W = 280
const H = 64

const points = computed(() =>
  SERIES.map((value, index) => ({
    x: (index / (SERIES.length - 1)) * W,
    y: H - (value / 100) * (H - 6) - 3
  }))
)

const linePath = computed(() =>
  points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
)

const areaPath = computed(() => `${linePath.value} L${W},${H} L0,${H} Z`)
const lastPoint = computed(() => points.value[points.value.length - 1])

// ── 流水 ────────────────────────────────────────────────
interface LogRow {
  id: number
  member: string
  group: string
  tokens: string
  cost: string
}

const MEMBERS = ['wei@acme.io', 'lin@acme.io', 'chen@acme.io', 'zhao@acme.io']
const GROUP_KEYS = ['default', 'enterprise', 'image'] as const
const SAMPLES = [
  { tokens: 1843, cost: 0.0092 },
  { tokens: 612, cost: 0.0031 },
  { tokens: 8420, cost: 0.0418 },
  { tokens: 2196, cost: 0.0109 },
  { tokens: 5031, cost: 0.0251 },
  { tokens: 374, cost: 0.0018 }
]
const MAX_ROWS = 4

const rows = ref<LogRow[]>([])
let cursor = 0
let seq = 0
let timer: number | undefined

const newestId = computed(() => (rows.value.length ? rows.value[0].id : -1))

const buildRow = (): LogRow => {
  const sample = SAMPLES[cursor % SAMPLES.length]
  const row: LogRow = {
    id: seq,
    member: MEMBERS[cursor % MEMBERS.length],
    group: t(`landing.console.group.${GROUP_KEYS[cursor % GROUP_KEYS.length]}`),
    tokens: sample.tokens.toLocaleString('en-US'),
    cost: `$${sample.cost.toFixed(4)}`
  }
  cursor += 1
  seq += 1
  return row
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

onMounted(() => {
  // 一打开就是满的，不从空列表长出来
  for (let i = 0; i < MAX_ROWS; i += 1) rows.value.push(buildRow())
  if (prefersReducedMotion()) return
  timer = window.setInterval(() => {
    rows.value = [buildRow(), ...rows.value].slice(0, MAX_ROWS)
  }, 2800)
})

onBeforeUnmount(() => {
  if (timer !== undefined) window.clearInterval(timer)
})
</script>

<style scoped>
.hc {
  --abyss: #0a1938;
  --rule: rgba(255, 255, 255, 0.08);
  --text: #c3cee4;
  --dim: #7286a8;
  --accent: #7fa4ef;
  overflow: hidden;
  border-radius: 14px;
  background: var(--abyss);
  font-variant-numeric: tabular-nums;
}

.hc-mono,
.hc-bar,
.hc-metric-label,
.hc-metric-value,
.hc-metric-note,
.hc-chart-label,
.hc-chart-figure,
.hc-log-head,
.hc-row,
.hc-foot {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* 顶条 */
.hc-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px;
  border-bottom: 1px solid var(--rule);
  font-size: 11px;
  letter-spacing: 0.08em;
}

.hc-live {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-weight: 600;
}

.hc-range {
  color: var(--dim);
}

.hc-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #10b981;
  animation: hc-pulse 2.8s ease-out infinite;
}

.hc-dot-static {
  animation: none;
}

/* 三个数 */
.hc-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid var(--rule);
}

.hc-metric {
  padding: 14px 16px;
}

.hc-metric + .hc-metric {
  border-left: 1px solid var(--rule);
}

.hc-metric-label {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
}

.hc-metric-value {
  margin-top: 7px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
}

.hc-metric-unit {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.hc-metric-note {
  margin-top: 7px;
  font-size: 10px;
  color: var(--dim);
}

.hc-metric-note.is-up {
  color: #34d399;
}

/* 趋势 */
.hc-chart {
  padding: 14px 16px 8px;
  border-bottom: 1px solid var(--rule);
}

.hc-chart-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.hc-chart-label {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
}

.hc-chart-figure {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}

.hc-delta {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 600;
  color: #34d399;
}

.hc-svg {
  display: block;
  width: 100%;
  height: 64px;
  margin-top: 8px;
}

/* 流水 */
.hc-log-head,
.hc-row {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) 4.25rem 4.75rem;
  gap: 10px;
  align-items: center;
  padding: 0 16px;
}

.hc-log-head {
  height: 28px;
  border-bottom: 1px solid var(--rule);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
}

.hc-rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.hc-row {
  height: 32px;
  font-size: 11.5px;
  color: var(--text);
}

.hc-row + .hc-row {
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.hc-row.is-new {
  animation: hc-arrive 620ms ease-out;
}

.hc-member {
  overflow: hidden;
  color: #fff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hc-group {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hc-right {
  text-align: right;
}

.hc-dim {
  color: var(--dim);
}

.hc-cost {
  color: var(--accent);
}

/* 底条 */
.hc-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--rule);
  background: rgba(255, 255, 255, 0.02);
}

.hc-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px;
  border: 1px solid var(--rule);
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--dim);
}

.hc-chip.is-ok {
  border-color: rgba(52, 211, 153, 0.28);
  color: #34d399;
}

@keyframes hc-arrive {
  0% {
    background: rgba(127, 164, 239, 0.14);
    opacity: 0;
    transform: translateY(-5px);
  }
  100% {
    background: transparent;
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes hc-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}

@media (max-width: 520px) {
  .hc-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hc-metric:nth-child(3) {
    border-left: 0;
    border-top: 1px solid var(--rule);
    grid-column: span 2;
  }

  .hc-log-head,
  .hc-row {
    grid-template-columns: minmax(0, 1.3fr) 4rem 4.5rem;
  }

  .hc-group {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hc-dot,
  .hc-row.is-new {
    animation: none;
  }
}
</style>
