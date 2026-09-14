<template>
  <div data-testid="default-home" class="lp">
    <LandingNav current="home" />

    <main>
      <!-- ══════ 首屏：整块深蓝 ══════ -->
      <section class="hm-hero lp-on-dark">
        <div class="hm-hero-grid" aria-hidden="true"></div>
        <div class="lp-shell hm-hero-inner">
          <div class="hm-hero-copy">
            <p class="hm-eyebrow">{{ t('landing.home.eyebrow') }}</p>
            <h1 class="hm-title">{{ t('landing.home.title') }}</h1>
            <p class="hm-lede">{{ t('landing.home.lede') }}</p>
            <div class="hm-actions">
              <router-link to="/pricing" class="lp-cta">{{ t('landing.home.tryNow') }}</router-link>
              <router-link v-if="showModelPlaza" to="/model-plaza" class="lp-ghost">
                {{ t('landing.home.viewModels') }}
              </router-link>
            </div>
          </div>

          <div class="hm-hero-panel">
            <HeroConsole />
            <p class="hm-hero-caption">{{ t('landing.console.disclaimer') }}</p>
          </div>
        </div>
      </section>

      <!-- ══════ 定价入口 ══════ -->
      <section class="lp-band">
        <div class="lp-shell">
          <div class="lp-secthead">
            <div>
              <p class="lp-eyebrow">{{ t('landing.price.eyebrow') }}</p>
              <h2 class="lp-heading">{{ t('landing.price.title') }}</h2>
            </div>
            <p class="lp-secnote">{{ t('landing.price.note') }}</p>
          </div>

          <div class="hm-price">
            <router-link to="/pricing" class="hm-price-item">
              <h3 class="hm-price-name">{{ t('landing.price.personal.tag') }}</h3>
              <span class="hm-price-value">{{ personalRate }}</span>
              <span class="hm-price-desc">{{ t('landing.price.personal.desc') }}</span>
              <span class="hm-price-more">{{ t('landing.price.personal.more') }} →</span>
            </router-link>
            <router-link to="/pricing" class="hm-price-item">
              <h3 class="hm-price-name">{{ t('landing.price.enterprise.tag') }}</h3>
              <span class="hm-price-value is-text">{{ t('landing.price.enterprise.value') }}</span>
              <span class="hm-price-desc">{{ t('landing.price.enterprise.desc') }}</span>
              <span class="hm-price-more">{{ t('landing.price.enterprise.more') }} →</span>
            </router-link>
            <component
              :is="showModelPlaza ? 'router-link' : 'div'"
              :to="showModelPlaza ? '/model-plaza' : undefined"
              class="hm-price-item"
            >
              <h3 class="hm-price-name">{{ t('landing.price.models.tag') }}</h3>
              <span class="hm-price-value is-text">{{ t('landing.price.models.value') }}</span>
              <span class="hm-price-desc">{{ t('landing.price.models.desc') }}</span>
              <span v-if="showModelPlaza" class="hm-price-more">
                {{ t('landing.price.models.more') }} →
              </span>
            </component>
          </div>
        </div>
      </section>

      <!-- ══════ 平台能力 ══════ -->
      <section id="capabilities" class="lp-band lp-band-sunken">
        <div class="lp-shell">
          <div class="lp-secthead">
            <div>
              <p class="lp-eyebrow">{{ t('landing.capabilities.eyebrow') }}</p>
              <h2 class="lp-heading">{{ t('landing.capabilities.title') }}</h2>
            </div>
            <p class="lp-secnote">{{ t('landing.capabilities.note') }}</p>
          </div>

          <div class="hm-caps">
            <article v-for="item in capabilities" :key="item.key" class="hm-cap">
              <h3 class="hm-cap-title">{{ item.title }}</h3>
              <p v-if="item.figure" class="hm-cap-figure">{{ item.figure }}</p>
              <p class="hm-cap-desc">{{ item.desc }}</p>
            </article>
          </div>

        </div>
      </section>

      <!-- ══════ 组织管控 ══════ -->
      <section id="governance" class="lp-band">
        <div class="lp-shell">
          <div class="lp-secthead">
            <div>
              <p class="lp-eyebrow">{{ t('landing.governance.eyebrow') }}</p>
              <h2 class="lp-heading">{{ t('landing.governance.title') }}</h2>
            </div>
            <p class="lp-secnote">{{ t('landing.governance.note') }}</p>
          </div>

          <div class="hm-govern">
            <div><OrgScopeCard /></div>
            <dl class="hm-defs">
              <div v-for="item in governance" :key="item.key" class="hm-def">
                <dt>{{ item.title }}</dt>
                <dd>{{ item.desc }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <!-- ══════ 技术规格：真表格 ══════ -->
      <section id="spec" class="lp-band lp-band-sunken">
        <div class="lp-shell">
          <div class="lp-secthead">
            <div>
              <p class="lp-eyebrow">{{ t('landing.spec.eyebrow') }}</p>
              <h2 class="lp-heading">{{ t('landing.spec.title') }}</h2>
            </div>
            <p class="lp-secnote">{{ t('landing.spec.note') }}</p>
          </div>

          <table class="hm-spec">
            <tbody>
              <tr v-for="row in specRows" :key="row.key">
                <th scope="row">{{ row.label }}</th>
                <td>{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ══════ 接入流程 ══════ -->
      <section class="lp-band">
        <div class="lp-shell">
          <div class="lp-secthead">
            <div>
              <p class="lp-eyebrow">{{ t('landing.steps.eyebrow') }}</p>
              <h2 class="lp-heading">{{ t('landing.steps.title') }}</h2>
            </div>
            <p class="lp-secnote">{{ t('landing.steps.note') }}</p>
          </div>

          <ol class="hm-steps">
            <li v-for="(step, index) in steps" :key="step.key" class="hm-step">
              <span class="hm-step-no">{{ String(index + 1).padStart(2, '0') }}</span>
              <div>
                <h3 class="hm-step-title">{{ step.title }}</h3>
                <p class="hm-step-desc">{{ step.desc }}</p>
              </div>
            </li>
          </ol>

          <div class="hm-code">
            <div class="hm-code-bar">
              <span>{{ t('landing.steps.request') }}</span>
              <span class="hm-code-hint">{{ t('landing.steps.compatible') }}</span>
            </div>
            <pre class="hm-pre"><code>{{ snippet }}</code></pre>
            <div class="hm-code-bar is-foot"><span>{{ t('landing.steps.returned') }}</span></div>
            <dl class="hm-returned">
              <div v-for="field in returnedFields" :key="field.name">
                <dt>{{ field.name }}</dt>
                <dd>{{ field.note }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <!-- ══════ 服务保障 ══════ -->
      <section class="lp-band lp-band-sunken">
        <div class="lp-shell">
          <div class="lp-secthead">
            <div>
              <p class="lp-eyebrow">{{ t('landing.service.eyebrow') }}</p>
              <h2 class="lp-heading">{{ t('landing.service.title') }}</h2>
            </div>
            <p class="lp-secnote">
              {{ t('landing.service.note') }}
              <a :href="salesMailto" class="lp-textlink">{{ salesEmail }}</a>
            </p>
          </div>

          <table class="hm-spec">
            <tbody>
              <tr v-for="item in services" :key="item.key">
                <th scope="row">{{ item.title }}</th>
                <td>{{ item.desc }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ══════ 应用场景（占位，清空即不渲染） ══════ -->
      <section v-if="cases.length" id="cases" class="lp-band">
        <div class="lp-shell">
          <div class="lp-secthead">
            <div>
              <p class="lp-eyebrow">{{ t('landing.cases.eyebrow') }}</p>
              <h2 class="lp-heading">{{ t('landing.cases.title') }}</h2>
            </div>
            <p class="lp-secnote">{{ t('landing.cases.note') }}</p>
          </div>

          <div class="hm-cases">
            <article v-for="item in cases" :key="item.industry" class="hm-case">
              <p class="hm-case-industry">{{ item.industry }}</p>
              <p class="hm-case-scale">{{ item.scale }}</p>
              <p class="hm-case-usage">{{ item.usage }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- ══════ 收尾 ══════ -->
      <section class="hm-closer lp-on-dark">
        <div class="lp-shell hm-closer-inner">
          <div>
            <h2 class="hm-closer-title">{{ t('landing.closer.title') }}</h2>
            <p class="hm-closer-desc">{{ t('landing.closer.desc') }}</p>
          </div>
          <div class="hm-actions hm-closer-actions">
            <router-link to="/pricing" class="lp-cta">{{ t('landing.home.tryNow') }}</router-link>
            <a :href="salesMailto" class="lp-ghost">{{ t('landing.closer.contact') }}</a>
          </div>
        </div>
      </section>
    </main>

    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LandingNav from './LandingNav.vue'
import LandingFooter from './LandingFooter.vue'
import HeroConsole from './HeroConsole.vue'
import OrgScopeCard from './OrgScopeCard.vue'
import { useLandingChrome } from './useLandingChrome'
import {
  CASE_STUDIES,
  GATEWAY_LATENCY,
  OFFERS_PRIVATE_DEPLOY,
  PERSONAL_RATE,
  SALES_EMAIL,
  SHOW_SECURITY_FIREWALL,
  SLA_UPTIME
} from './landingContent'
import { useModelCoverage } from './useModelCoverage'
import './landing.css'

const { t } = useI18n()
const { showModelPlaza } = useLandingChrome()
const { modelCount, groupCount, hasCounts } = useModelCoverage()

const personalRate = computed(() => PERSONAL_RATE)
const salesEmail = computed(() => SALES_EMAIL)
const salesMailto = computed(
  () => `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(t('landing.service.mailSubject'))}`
)

const governance = computed(() =>
  (['isolation', 'budget', 'scope', 'suspend'] as const).map((key) => ({
    key,
    title: t(`landing.governance.${key}.title`),
    desc: t(`landing.governance.${key}.desc`)
  }))
)

/**
 * 平台能力只放「自己搭一套开源网关装不出来」的东西。
 *
 * 协议兼容、密钥管理、权限控制这类是网关的基本盘，任何同类项目都有，
 * 摆在这里等于自认没有差异——它们已经下沉到技术规格表里当参数。
 *
 * 带数字的几项从真实数据来：模型数读模型广场目录，可用性和延迟读
 * landingContent 里的承诺值，没填就不出数字，只讲机制。
 */
const capabilities = computed(() => {
  const items: {
    key: string
    title: string
    figure: string
    desc: string
  }[] = []

  items.push({
    key: 'organization',
    title: t('landing.capabilities.organization.title'),
    figure: '',
    desc: t('landing.capabilities.organization.desc')
  })

  if (SHOW_SECURITY_FIREWALL) {
    items.push({
      key: 'firewall',
        title: t('landing.capabilities.firewall.title'),
      figure: '',
      desc: t('landing.capabilities.firewall.desc')
    })
  }

  items.push({
    key: 'coverage',
    title: t('landing.capabilities.coverage.title'),
    figure: hasCounts.value
      ? t('landing.capabilities.coverage.figure', {
          models: modelCount.value,
          groups: groupCount.value
        })
      : '',
    desc: t('landing.capabilities.coverage.desc')
  })

  items.push({
    key: 'availability',
    title: t('landing.capabilities.availability.title'),
    figure: SLA_UPTIME,
    desc: t('landing.capabilities.availability.desc')
  })

  items.push({
    key: 'latency',
    title: t('landing.capabilities.latency.title'),
    figure: GATEWAY_LATENCY,
    desc: t('landing.capabilities.latency.desc')
  })

  if (OFFERS_PRIVATE_DEPLOY) {
    items.push({
      key: 'deploy',
        title: t('landing.capabilities.deploy.title'),
      figure: '',
      desc: t('landing.capabilities.deploy.desc')
    })
  }

  return items
})

// 技术规格表。企业选型时逐行对照的就是这张。
const specRows = computed(() =>
  (
    ['protocol', 'auth', 'stream', 'quota', 'precision', 'settle', 'records', 'export', 'deploy'] as const
  ).map((key) => ({
    key,
    label: t(`landing.spec.rows.${key}.label`),
    value: t(`landing.spec.rows.${key}.value`)
  }))
)

const steps = computed(() =>
  (['create', 'point', 'allocate'] as const).map((key) => ({
    key,
    title: t(`landing.steps.${key}.title`),
    desc: t(`landing.steps.${key}.desc`)
  }))
)

const returnedFields = computed(() =>
  (['organization', 'member', 'group', 'usage', 'cost', 'latency'] as const).map((key) => ({
    name: t(`landing.steps.fields.${key}.name`),
    note: t(`landing.steps.fields.${key}.note`)
  }))
)

const services = computed(() =>
  (['support', 'isolation', 'retention', 'selfhost'] as const).map((key) => ({
    key,
    title: t(`landing.service.items.${key}.title`),
    desc: t(`landing.service.items.${key}.desc`)
  }))
)

const cases = computed(() =>
  CASE_STUDIES.map((item) => ({
    industry: t(`landing.cases.items.${item.industryKey}`),
    scale: t(`landing.cases.items.${item.scaleKey}`),
    usage: t(`landing.cases.items.${item.usageKey}`)
  }))
)

const snippet = `curl https://your-domain.example/v1/chat/completions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "<model>", "messages": [{"role": "user", "content": "hi"}]}'`
</script>

<style scoped>
/* ══════ 首屏：整块深蓝，这是「不是 SaaS」最直接的信号 ══════ */
.hm-hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, #0a1938 0%, #102a55 55%, #0c1f42 100%);
}

/* 极淡的网格，只提供质地，不抢内容 */
.hm-hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse 80% 70% at 30% 30%, #000 25%, transparent 75%);
}

.hm-hero-inner {
  position: relative;
  display: grid;
  gap: 44px;
  padding-top: 72px;
  padding-bottom: 72px;
}

.hm-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: #8fa8d8;
}

.hm-eyebrow::before {
  width: 2px;
  height: 12px;
  background: #5080e2;
  content: '';
}

.hm-title {
  margin: 20px 0 0;
  font-size: clamp(2.125rem, 4.2vw, 3.125rem);
  font-weight: 700;
  line-height: 1.24;
  letter-spacing: -0.02em;
  color: #fff;
}

.hm-lede {
  max-width: 34rem;
  margin: 20px 0 0;
  font-size: 1rem;
  line-height: 1.9;
  color: #aebbd6;
}

.hm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 32px;
}

.hm-hero-caption {
  margin: 12px 0 0;
  font-size: 11px;
  color: #6d80a6;
}

@media (min-width: 1000px) {
  .hm-hero-inner {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
    align-items: center;
    gap: 56px;
    padding-top: 96px;
    padding-bottom: 104px;
  }
}

/* ══════ 定价入口：细线分隔的三栏，不是圆角卡 ══════ */
.hm-price {
  display: grid;
  gap: 16px;
}

.hm-price-item {
  display: flex;
  flex-direction: column;
  padding: 26px 24px 24px;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--paper);
  text-decoration: none;
  transition: border-color 150ms ease;
}

a.hm-price-item:hover {
  border-color: var(--navy);
}

.hm-price-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ink);
}

.hm-price-value {
  margin-top: 12px;
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.hm-price-value.is-text {
  font-size: 1.5rem;
  letter-spacing: -0.015em;
}

.hm-price-desc {
  flex: 1;
  margin-top: 14px;
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--muted);
}

.hm-price-more {
  margin-top: 18px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--navy);
}

@media (min-width: 860px) {
  .hm-price {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

/* ══════ 能力：编号清单 ══════ */
/* 六格共用一圈外框，内部靠分隔线切开。
   比各自独立的圆角卡更像一块完整的产品清单。 */
.hm-caps {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--paper);
}

.hm-cap {
  padding: 26px 24px 28px;
  border-bottom: 1px solid var(--rule);
}

.hm-cap:last-child {
  border-bottom: 0;
}

.hm-cap-title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ink);
}

.hm-cap-figure {
  margin: 10px 0 0;
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--navy);
  font-variant-numeric: tabular-nums;
}

.hm-cap-desc {
  margin: 8px 0 0;
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--muted);
}

@media (min-width: 760px) {
  .hm-caps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hm-cap:nth-child(odd) {
    border-right: 1px solid var(--rule);
  }

  .hm-cap:nth-last-child(-n + 2) {
    border-bottom: 0;
  }
}

@media (min-width: 1060px) {
  .hm-caps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .hm-cap:not(:nth-child(3n)) {
    border-right: 1px solid var(--rule);
  }

  .hm-cap:nth-child(3n) {
    border-right: 0;
  }

  .hm-cap:nth-last-child(-n + 3) {
    border-bottom: 0;
  }
}

/* ══════ 组织管控 ══════ */
.hm-govern {
  display: grid;
  gap: 40px;
}

.hm-defs {
  display: grid;
  gap: 12px;
  margin: 0;
}

.hm-def {
  padding: 18px 20px;
  border: 1px solid var(--rule);
  border-left: 3px solid var(--navy);
  border-radius: 4px;
  background: var(--paper);
}

.hm-def dt {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ink);
}

.hm-def dd {
  margin: 7px 0 0;
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--muted);
}

@media (min-width: 940px) {
  .hm-govern {
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    align-items: start;
    gap: 64px;
  }
}

/* ══════ 规格表 / 服务条款表 ══════ */
.hm-spec {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--paper);
}

.hm-spec th[scope='row'] {
  width: 30%;
  padding: 16px 24px;
  border-bottom: 1px solid var(--rule);
  font-size: 0.875rem;
  font-weight: 600;
  text-align: left;
  vertical-align: top;
  color: var(--ink);
}

.hm-spec td {
  padding: 16px 24px 16px 0;
  border-bottom: 1px solid var(--rule);
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--muted);
}

.hm-spec tr:last-child th[scope='row'],
.hm-spec tr:last-child td {
  border-bottom: 0;
}

@media (max-width: 620px) {
  .hm-spec th[scope='row'] {
    width: 40%;
    padding: 14px 12px 14px 16px;
  }

  .hm-spec td {
    padding: 14px 16px 14px 0;
  }
}

/* ══════ 接入流程 ══════ */
.hm-steps {
  display: grid;
  gap: 0;
  margin: 0 0 40px;
  padding: 0;
  border-top: 1px solid var(--rule);
  list-style: none;
}

.hm-step {
  display: flex;
  gap: 20px;
  padding: 22px 0;
  border-bottom: 1px solid var(--rule);
}

.hm-step-no {
  flex-shrink: 0;
  width: 2rem;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--navy);
  font-variant-numeric: tabular-nums;
}

.hm-step-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
}

.hm-step-desc {
  margin: 7px 0 0;
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--muted);
}

.hm-code {
  overflow: hidden;
  border-radius: 6px;
  background: var(--abyss);
}

.hm-code-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #7286a8;
}

.hm-code-hint {
  text-transform: none;
  letter-spacing: 0.02em;
}

.hm-code-bar.is-foot {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 0;
}

.hm-pre {
  margin: 0;
  overflow-x: auto;
  padding: 20px 18px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.85;
  color: #c3cee4;
}

.hm-returned {
  display: grid;
  margin: 0;
  padding: 6px 18px 18px;
}

.hm-returned > div {
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: 6px 0;
}

.hm-returned dt {
  min-width: 8.25rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #7fa4ef;
}

.hm-returned dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #8fa0bd;
}

@media (min-width: 760px) {
  .hm-returned {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 28px;
  }
}

/* ══════ 应用场景 ══════ */
.hm-cases {
  display: grid;
  gap: 16px;
}

.hm-case {
  padding: 24px;
  border: 1px solid var(--rule);
  border-top: 3px solid var(--rule-strong);
  border-radius: 4px;
  background: var(--paper);
}

.hm-case-industry {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--ink);
}

.hm-case-scale {
  margin: 6px 0 0;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: var(--subtle);
}

.hm-case-usage {
  margin: 12px 0 0;
  font-size: 0.875rem;
  line-height: 1.8;
  color: var(--muted);
}

@media (min-width: 760px) {
  .hm-cases {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1060px) {
  .hm-cases {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

/* ══════ 收尾：呼应首屏的深蓝 ══════ */
.hm-closer {
  background: var(--abyss);
}

.hm-closer-inner {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-top: 56px;
  padding-bottom: 56px;
}

.hm-closer-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: #fff;
}

.hm-closer-desc {
  max-width: 36rem;
  margin: 10px 0 0;
  font-size: 0.9375rem;
  line-height: 1.85;
  color: #aebbd6;
}

.hm-closer-actions {
  margin-top: 0;
}

@media (min-width: 860px) {
  .hm-closer-inner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 48px;
  }
}
</style>
