<template>
  <div class="scope" role="img" :aria-label="t('landing.scope.caption')">
    <div class="scope-head">
      <div>
        <div class="scope-eyebrow">{{ t('landing.scope.org') }}</div>
        <div class="scope-name">acme.io</div>
      </div>
      <div class="scope-balance">
        <div class="scope-eyebrow">{{ t('landing.scope.pool') }}</div>
        <div class="scope-amount">$2,000.00</div>
      </div>
    </div>

    <ul class="scope-members">
      <li v-for="member in members" :key="member.email" class="scope-member" :class="{ 'is-spent': member.spent }">
        <div class="scope-line">
          <span class="scope-email">{{ member.email }}</span>
          <span class="scope-figures">
            <span>{{ member.used }}</span>
            <span class="scope-slash">/</span>
            <span class="scope-cap">{{ member.cap }}</span>
          </span>
        </div>
        <div class="scope-track">
          <div class="scope-fill" :style="{ width: member.percent + '%' }"></div>
        </div>
        <div v-if="member.spent" class="scope-note">{{ t('landing.scope.stopped') }}</div>
      </li>
    </ul>

    <div class="scope-groups">
      <span class="scope-eyebrow">{{ t('landing.scope.granted') }}</span>
      <div class="scope-chips">
        <span v-for="chip in chips" :key="chip" class="scope-chip">{{ chip }}</span>
        <span class="scope-chip is-denied">{{ t('landing.scope.denied') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 组织治理那一节的示意卡。
 *
 * 用一张图同时说明四件事：成员只在本组织里、每人有自己的上限、
 * 一个人用尽只停他一个、可用分组由平台授权。
 */
const { t } = useI18n()

const members = [
  { email: 'wei@acme.io', used: '$132.40', cap: '$200.00', percent: 66, spent: false },
  { email: 'lin@acme.io', used: '$486.20', cap: '—', percent: 34, spent: false },
  { email: 'chen@acme.io', used: '$50.00', cap: '$50.00', percent: 100, spent: true }
]

const chips = computed(() => [
  t('landing.console.group.default'),
  t('landing.console.group.enterprise'),
  t('landing.console.group.image')
])
</script>

<style scoped>
.scope {
  --rule: #e7e5e4;
  --ink: #1c1917;
  --muted: #78716c;
  --subtle: #a8a29e;
  --navy: #1b4ba8;
  padding: 20px;
  border: 1px solid var(--rule);
  border-radius: 12px;
  background: #fff;
  font-variant-numeric: tabular-nums;
}

:global(.dark) .scope {
  --rule: #2c2926;
  --ink: #f5f4f2;
  --muted: #96918b;
  --subtle: #706b65;
  --navy: #5080e2;
  background: #1f1d1b;
}

.scope-eyebrow {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.scope-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--rule);
}

.scope-name {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ink);
}

.scope-balance {
  text-align: right;
}

.scope-amount {
  margin-top: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
}

.scope-members {
  margin: 0;
  padding: 16px 0 0;
  list-style: none;
}

.scope-member + .scope-member {
  margin-top: 14px;
}

.scope-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.scope-email {
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-figures {
  flex-shrink: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: var(--muted);
}

.scope-slash,
.scope-cap {
  color: var(--subtle);
}

.scope-track {
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: #f0eeec;
}

:global(.dark) .scope-track {
  background: #12110f;
}

.scope-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--navy);
}

.is-spent .scope-fill {
  background: #a8a29e;
}

.scope-note {
  margin-top: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--subtle);
}

.scope-groups {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--rule);
}

.scope-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.scope-chip {
  padding: 3px 8px;
  border-radius: 4px;
  background: #f1f5fd;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: #163c88;
}

:global(.dark) .scope-chip {
  background: rgba(80, 128, 226, 0.14);
  color: #8eadeb;
}

.scope-chip.is-denied {
  background: transparent;
  border: 1px dashed var(--rule);
  color: var(--subtle);
}
</style>
