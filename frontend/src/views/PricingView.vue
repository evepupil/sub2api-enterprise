<template>
  <div class="lp">
    <LandingNav current="pricing" />

    <main>
      <!-- ========== 页头 + 两个版本 ========== -->
      <section class="lp-band">
        <div class="lp-shell">
          <div class="pg-head">
            <p class="lp-eyebrow">{{ t('pricing.eyebrow') }}</p>
            <h1 class="lp-display">{{ t('pricing.title') }}</h1>
            <p class="lp-lede">{{ t('pricing.lede') }}</p>
          </div>

          <div class="pg-plans">
            <!-- 个人版 -->
            <article class="pg-plan">
              <div class="pg-plan-head">
                <h2 class="pg-plan-name">{{ t('pricing.personal.name') }}</h2>
                <p class="pg-plan-for">{{ t('pricing.personal.for') }}</p>
              </div>

              <div class="pg-price">
                <span class="pg-rate">{{ personalRate }}</span>
                <span class="pg-rate-unit">{{ t('pricing.personal.rateUnit') }}</span>
              </div>
              <p class="pg-price-note">{{ t('pricing.personal.rateNote') }}</p>

              <router-link to="/register" class="lp-cta pg-plan-cta">
                {{ t('pricing.personal.cta') }}
              </router-link>

              <ul class="pg-list">
                <li v-for="item in personalPoints" :key="item" class="pg-item">
                  <Icon name="check" size="xs" class="pg-check" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </article>

            <!-- 企业版 -->
            <article class="pg-plan is-featured">
              <div class="pg-plan-head">
                <h2 class="pg-plan-name">{{ t('pricing.enterprise.name') }}</h2>
                <p class="pg-plan-for">{{ t('pricing.enterprise.for') }}</p>
              </div>

              <div class="pg-price">
                <span class="pg-quote">{{ t('pricing.enterprise.quote') }}</span>
              </div>
              <p class="pg-price-note">{{ t('pricing.enterprise.quoteNote') }}</p>

              <a :href="salesMailto" class="lp-cta pg-plan-cta">
                {{ t('pricing.enterprise.cta') }}
              </a>

              <ul class="pg-list">
                <li v-for="item in enterprisePoints" :key="item" class="pg-item">
                  <Icon name="check" size="xs" class="pg-check" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <!-- ========== 能力对照表 ========== -->
      <section class="lp-band lp-band-sunken">
        <div class="lp-shell">
          <div class="lp-secthead">
            <div>
              <p class="lp-eyebrow">{{ t('pricing.compare.eyebrow') }}</p>
              <h2 class="lp-heading">{{ t('pricing.compare.title') }}</h2>
            </div>
            <p class="lp-secnote">{{ t('pricing.compare.note') }}</p>
          </div>

          <div class="pg-table-wrap">
            <table class="pg-table">
              <thead>
                <tr>
                  <th scope="col">{{ t('pricing.compare.capability') }}</th>
                  <th scope="col">{{ t('pricing.personal.name') }}</th>
                  <th scope="col">{{ t('pricing.enterprise.name') }}</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="group in compareGroups" :key="group.key">
                  <tr class="pg-group-row">
                    <th scope="rowgroup" colspan="3">{{ group.title }}</th>
                  </tr>
                  <tr v-for="row in group.rows" :key="row.key">
                    <th scope="row">{{ row.label }}</th>
                    <td>
                      <Icon v-if="row.personal === true" name="check" size="xs" class="pg-check" />
                      <span v-else-if="row.personal === false" class="pg-dash">—</span>
                      <span v-else>{{ row.personal }}</span>
                    </td>
                    <td>
                      <Icon v-if="row.enterprise === true" name="check" size="xs" class="pg-check" />
                      <span v-else-if="row.enterprise === false" class="pg-dash">—</span>
                      <span v-else>{{ row.enterprise }}</span>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ========== 计费口径 ========== -->
      <section class="lp-band">
        <div class="lp-shell">
          <div class="lp-secthead">
            <div>
              <p class="lp-eyebrow">{{ t('pricing.billing.eyebrow') }}</p>
              <h2 class="lp-heading">{{ t('pricing.billing.title') }}</h2>
            </div>
            <p class="lp-secnote">
              {{ t('pricing.billing.note') }}
              <router-link v-if="showModelPlaza" to="/model-plaza" class="lp-textlink">
                {{ t('pricing.billing.viewModels') }}
              </router-link>
            </p>
          </div>

          <dl class="pg-rules">
            <div v-for="rule in billingRules" :key="rule.key" class="pg-rule">
              <dt>{{ rule.title }}</dt>
              <dd>{{ rule.desc }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <!-- ========== 常见问题 ========== -->
      <section class="lp-band lp-band-sunken lp-band-last">
        <div class="lp-shell">
          <div class="lp-secthead">
            <div>
              <p class="lp-eyebrow">{{ t('pricing.faq.eyebrow') }}</p>
              <h2 class="lp-heading">{{ t('pricing.faq.title') }}</h2>
            </div>
            <p class="lp-secnote">
              {{ t('pricing.faq.note') }}
              <a :href="salesMailto" class="lp-textlink">{{ salesEmail }}</a>
            </p>
          </div>

          <dl class="pg-faq">
            <div v-for="item in faq" :key="item.key" class="pg-faq-item">
              <dt>{{ item.q }}</dt>
              <dd>{{ item.a }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>

    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import LandingNav from './landing/LandingNav.vue'
import LandingFooter from './landing/LandingFooter.vue'
import { useLandingChrome } from './landing/useLandingChrome'
import { PERSONAL_RATE, SALES_EMAIL } from './landing/landingContent'
import { useAppStore } from '@/stores'
import './landing/landing.css'

const { t } = useI18n()
const appStore = useAppStore()
const { showModelPlaza } = useLandingChrome()

const personalRate = computed(() => PERSONAL_RATE)
const salesEmail = computed(() => SALES_EMAIL)
const salesMailto = computed(
  () => `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(t('pricing.enterprise.mailSubject'))}`
)

const personalPoints = computed(() =>
  (['models', 'keys', 'records', 'usage', 'support'] as const).map((key) =>
    t(`pricing.personal.points.${key}`)
  )
)

const enterprisePoints = computed(() =>
  (['everything', 'members', 'budgets', 'scope', 'suspend', 'contact'] as const).map((key) =>
    t(`pricing.enterprise.points.${key}`)
  )
)

/** 对照表。true 打勾，false 破折号，字符串直接显示。 */
type Cell = true | false | string

interface CompareRow {
  key: string
  label: string
  personal: Cell
  enterprise: Cell
}

const compareGroups = computed<{ key: string; title: string; rows: CompareRow[] }[]>(() => [
  {
    key: 'calling',
    title: t('pricing.compare.groups.calling'),
    rows: [
      { key: 'formats', label: t('pricing.compare.rows.formats'), personal: true, enterprise: true },
      { key: 'groups', label: t('pricing.compare.rows.groups'), personal: t('pricing.compare.values.platformDefault'), enterprise: t('pricing.compare.values.perOrg') },
      { key: 'failover', label: t('pricing.compare.rows.failover'), personal: true, enterprise: true },
      { key: 'keyQuota', label: t('pricing.compare.rows.keyQuota'), personal: true, enterprise: true }
    ]
  },
  {
    key: 'billing',
    title: t('pricing.compare.groups.billing'),
    rows: [
      { key: 'rate', label: t('pricing.compare.rows.rate'), personal: PERSONAL_RATE, enterprise: t('pricing.compare.values.negotiated') },
      { key: 'metered', label: t('pricing.compare.rows.metered'), personal: true, enterprise: true },
      { key: 'payer', label: t('pricing.compare.rows.payer'), personal: t('pricing.compare.values.self'), enterprise: t('pricing.compare.values.orgOwner') }
    ]
  },
  {
    key: 'org',
    title: t('pricing.compare.groups.org'),
    rows: [
      { key: 'members', label: t('pricing.compare.rows.members'), personal: false, enterprise: true },
      { key: 'budgets', label: t('pricing.compare.rows.budgets'), personal: false, enterprise: true },
      { key: 'split', label: t('pricing.compare.rows.split'), personal: false, enterprise: true },
      { key: 'suspend', label: t('pricing.compare.rows.suspend'), personal: false, enterprise: true },
      { key: 'invite', label: t('pricing.compare.rows.invite'), personal: false, enterprise: true }
    ]
  },
  {
    key: 'records',
    title: t('pricing.compare.groups.records'),
    rows: [
      { key: 'perCall', label: t('pricing.compare.rows.perCall'), personal: true, enterprise: true },
      { key: 'scopeOfUsage', label: t('pricing.compare.rows.scopeOfUsage'), personal: t('pricing.compare.values.selfOnly'), enterprise: t('pricing.compare.values.wholeOrg') },
      { key: 'export', label: t('pricing.compare.rows.export'), personal: true, enterprise: true },
      { key: 'support', label: t('pricing.compare.rows.support'), personal: t('pricing.compare.values.email'), enterprise: t('pricing.compare.values.dedicated') }
    ]
  }
])

const billingRules = computed(() =>
  (['metered', 'precision', 'realtime', 'rate', 'payer'] as const).map((key) => ({
    key,
    title: t(`pricing.billing.rules.${key}.title`),
    desc: t(`pricing.billing.rules.${key}.desc`)
  }))
)

const faq = computed(() =>
  (['switch', 'overspend', 'leak', 'invoice'] as const).map((key) => ({
    key,
    q: t(`pricing.faq.items.${key}.q`),
    a: t(`pricing.faq.items.${key}.a`)
  }))
)

onMounted(() => {
  void appStore.fetchPublicSettings()
})
</script>

<style scoped>
.pg-head {
  max-width: 44rem;
  margin-bottom: 52px;
}

/* ══════ 两个版本 ══════ */
.pg-plans {
  display: grid;
  gap: 20px;
}

.pg-plan {
  display: flex;
  flex-direction: column;
  padding: 30px 28px 32px;
  border: 1px solid var(--rule);
  border-top: 3px solid var(--rule-strong);
  border-radius: 4px;
  background: var(--paper);
}

/* 企业版靠顶边换成主色区分，不放大也不加投影 */
.pg-plan.is-featured {
  border-top-color: var(--navy);
}

.pg-plan-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.pg-plan-for {
  margin: 6px 0 0;
  font-size: 0.875rem;
  color: var(--muted);
}

.pg-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 26px;
}

.pg-rate {
  font-size: 3rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.pg-rate-unit,
.pg-quote {
  font-size: 0.9375rem;
  color: var(--muted);
}

.pg-quote {
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--ink);
}

.pg-price-note {
  margin: 12px 0 0;
  min-height: 2.6em;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--muted);
}

.pg-plan-cta {
  margin-top: 20px;
  width: 100%;
}

.pg-list {
  margin: 28px 0 0;
  padding: 24px 0 0;
  border-top: 1px solid var(--rule);
  list-style: none;
  display: grid;
  gap: 12px;
}

.pg-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--body);
}

.pg-check {
  flex-shrink: 0;
  margin-top: 4px;
  color: var(--navy);
}

.pg-dash {
  color: var(--subtle);
}

@media (min-width: 820px) {
  .pg-plans {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
  }
}

/* ══════ 对照表 ══════ */
.pg-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--paper);
}

.pg-table {
  width: 100%;
  min-width: 34rem;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.pg-table thead th {
  padding: 15px 20px;
  border-bottom: 1px solid var(--rule);
  background: var(--sunken);
  font-size: 0.8125rem;
  font-weight: 600;
  text-align: left;
  color: var(--ink);
}

.pg-table thead th:not(:first-child),
.pg-table tbody td {
  width: 22%;
  text-align: center;
}

.pg-group-row th {
  padding: 16px 20px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-align: left;
  color: var(--navy);
}

.pg-table tbody th[scope='row'] {
  padding: 12px 20px;
  font-weight: 500;
  text-align: left;
  color: var(--ink);
}

.pg-table tbody td {
  padding: 12px 20px;
  color: var(--muted);
}

.pg-table tbody tr:not(.pg-group-row) + tr:not(.pg-group-row) th,
.pg-table tbody tr:not(.pg-group-row) + tr:not(.pg-group-row) td {
  border-top: 1px solid var(--rule);
}

/* ══════ 计费口径 ══════ */
.pg-rules {
  display: grid;
  gap: 0;
  margin: 0;
  border-top: 1px solid var(--rule);
}

.pg-rule {
  display: grid;
  gap: 6px;
  padding: 22px 0;
  border-bottom: 1px solid var(--rule);
}

.pg-rule dt {
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
}

.pg-rule dd {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--muted);
}

@media (min-width: 820px) {
  .pg-rule {
    grid-template-columns: minmax(0, 0.42fr) minmax(0, 1fr);
    gap: 32px;
    align-items: baseline;
  }
}

/* ══════ 常见问题 ══════ */
.pg-faq {
  display: grid;
  gap: 0;
  margin: 0;
  border-top: 1px solid var(--rule);
}

.pg-faq-item {
  padding: 20px 0;
  border-bottom: 1px solid var(--rule);
}

.pg-faq-item dt {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ink);
}

.pg-faq-item dd {
  margin: 9px 0 0;
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--muted);
}

@media (min-width: 820px) {
  .pg-faq {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 56px;
  }
}
</style>
