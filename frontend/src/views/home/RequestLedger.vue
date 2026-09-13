<template>
  <div class="ledger" :aria-label="t('home.ledger.caption')" role="img">
    <div class="ledger-bar">
      <span class="ledger-live">
        <span class="ledger-dot" aria-hidden="true"></span>
        {{ t('home.ledger.title') }}
      </span>
      <span class="ledger-org">acme.io</span>
    </div>

    <div class="ledger-head" aria-hidden="true">
      <span>{{ t('home.ledger.col.time') }}</span>
      <span>{{ t('home.ledger.col.member') }}</span>
      <span class="ledger-hide-sm">{{ t('home.ledger.col.group') }}</span>
      <span class="ledger-num">{{ t('home.ledger.col.tokens') }}</span>
      <span class="ledger-num ledger-hide-sm">{{ t('home.ledger.col.latency') }}</span>
      <span class="ledger-num">{{ t('home.ledger.col.cost') }}</span>
    </div>

    <ul class="ledger-rows">
      <li v-for="row in visibleRows" :key="row.id" class="ledger-row" :class="{ 'is-new': row.id === newestId }">
        <span class="ledger-time">{{ row.time }}</span>
        <span class="ledger-member">{{ row.member }}</span>
        <span class="ledger-group ledger-hide-sm">{{ row.group }}</span>
        <span class="ledger-num">{{ row.tokens }}</span>
        <span class="ledger-num ledger-dim ledger-hide-sm">{{ row.latency }}</span>
        <span class="ledger-num ledger-cost">{{ row.cost }}</span>
      </li>
    </ul>

    <div class="ledger-foot">
      <span>{{ t('home.ledger.total') }}</span>
      <span class="ledger-num ledger-sum">{{ runningTotal }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 首页的调用流水演示。
 *
 * 这是示意，不是实测数据——它要说明的是「每一次调用都记到人头上」这件事，
 * 所以列就是控制台里真实存在的那几列：时间、成员、分组、用量、耗时、费用。
 * 不出现任何上游厂商和型号名，分组名走文案，避免暗示合作关系。
 */
const { t } = useI18n()

interface LedgerRow {
  id: number
  time: string
  member: string
  group: string
  tokens: string
  latency: string
  cost: string
}

const MEMBERS = ['wei@acme.io', 'lin@acme.io', 'chen@acme.io', 'zhao@acme.io', 'sun@acme.io']

const GROUP_KEYS = ['default', 'enterprise', 'image'] as const

// 固定的一组取值，循环播放。刻意用不整齐的数字，整数看着就是编的。
const SAMPLES = [
  { tokens: 1843, latency: 1.24, cost: 0.0092 },
  { tokens: 612, latency: 0.41, cost: 0.0031 },
  { tokens: 8420, latency: 3.87, cost: 0.0418 },
  { tokens: 2196, latency: 1.02, cost: 0.0109 },
  { tokens: 374, latency: 0.29, cost: 0.0018 },
  { tokens: 5031, latency: 2.15, cost: 0.0251 },
  { tokens: 1288, latency: 0.76, cost: 0.0064 },
  { tokens: 9674, latency: 4.33, cost: 0.0483 }
]

const MAX_ROWS = 7

const rows = ref<LedgerRow[]>([])
const total = ref(0)
let cursor = 0
let seq = 0
let timer: number | undefined

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const pad = (value: number): string => String(value).padStart(2, '0')

const formatLatency = (seconds: number): string =>
  seconds < 1 ? `${Math.round(seconds * 1000)}ms` : `${seconds.toFixed(2)}s`

const buildRow = (offsetSeconds: number): LedgerRow => {
  const sample = SAMPLES[cursor % SAMPLES.length]
  const at = new Date(Date.now() - offsetSeconds * 1000)
  const row: LedgerRow = {
    id: seq,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`,
    member: MEMBERS[cursor % MEMBERS.length],
    group: t(`home.ledger.group.${GROUP_KEYS[cursor % GROUP_KEYS.length]}`),
    tokens: sample.tokens.toLocaleString('en-US'),
    latency: formatLatency(sample.latency),
    cost: sample.cost.toFixed(4)
  }
  total.value += sample.cost
  cursor += 1
  seq += 1
  return row
}

const visibleRows = computed(() => rows.value)
const newestId = computed(() => (rows.value.length ? rows.value[0].id : -1))
const runningTotal = computed(() => `$${total.value.toFixed(4)}`)

const pushRow = (): void => {
  rows.value = [buildRow(0), ...rows.value].slice(0, MAX_ROWS)
}

onMounted(() => {
  // 先铺满，页面一打开就是有内容的状态，不从空列表长出来
  for (let i = MAX_ROWS - 1; i >= 0; i -= 1) {
    rows.value = [buildRow(i * 4 + 2), ...rows.value]
  }
  rows.value = rows.value.slice(0, MAX_ROWS)

  if (prefersReducedMotion()) return
  timer = window.setInterval(pushRow, 2600)
})

onBeforeUnmount(() => {
  if (timer !== undefined) window.clearInterval(timer)
})
</script>

<style scoped>
.ledger {
  --abyss: #0a1938;
  --abyss-rule: rgba(255, 255, 255, 0.09);
  --abyss-text: #c3cee4;
  --abyss-dim: #6b7c9e;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 12px;
  background: var(--abyss);
  font-variant-numeric: tabular-nums;
}

.ledger-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--abyss-rule);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.ledger-live {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-weight: 600;
}

.ledger-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #10b981;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55);
  animation: ledger-pulse 2.6s ease-out infinite;
}

.ledger-org {
  color: var(--abyss-dim);
}

.ledger-head,
.ledger-row {
  display: grid;
  grid-template-columns: 4.75rem minmax(0, 1fr) 5.5rem 4.25rem 4rem 4.5rem;
  gap: 12px;
  align-items: center;
  padding: 0 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.ledger-head {
  height: 30px;
  border-bottom: 1px solid var(--abyss-rule);
  color: var(--abyss-dim);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.ledger-rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ledger-row {
  height: 34px;
  font-size: 12px;
  color: var(--abyss-text);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.ledger-row.is-new {
  animation: ledger-arrive 620ms ease-out;
}

.ledger-time,
.ledger-dim {
  color: var(--abyss-dim);
}

.ledger-member {
  overflow: hidden;
  color: #fff;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ledger-group {
  overflow: hidden;
  color: var(--abyss-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ledger-num {
  text-align: right;
}

.ledger-cost {
  color: #7fa4ef;
}

.ledger-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--abyss-rule);
  background: rgba(255, 255, 255, 0.02);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--abyss-dim);
}

.ledger-sum {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
  color: #fff;
  text-transform: none;
}

@keyframes ledger-arrive {
  0% {
    background: rgba(127, 164, 239, 0.16);
    opacity: 0;
    transform: translateY(-6px);
  }
  100% {
    background: transparent;
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes ledger-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}

@media (max-width: 640px) {
  .ledger-hide-sm {
    display: none;
  }

  .ledger-head,
  .ledger-row {
    grid-template-columns: 4.5rem minmax(0, 1fr) 4rem 4.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ledger-dot,
  .ledger-row.is-new {
    animation: none;
  }
}
</style>
