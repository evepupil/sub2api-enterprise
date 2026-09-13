<template>
  <!-- Custom Home Content: Full Page Mode -->
  <div v-if="hasHomeContent" class="min-h-screen">
    <!-- iframe mode -->
    <iframe
      v-if="isHomeContentUrl"
      :src="homeContent.trim()"
      class="h-screen w-full border-0"
      allowfullscreen
    ></iframe>
    <!-- HTML mode - SECURITY: homeContent is admin-only setting, XSS risk is acceptable -->
    <div v-else v-html="homeContent"></div>
  </div>

  <!-- Compact Home Page -->
  <div
    v-else-if="compactHomeEnabled"
    data-testid="compact-home"
    class="flex min-h-screen flex-col bg-gray-50 text-gray-900 dark:bg-dark-950 dark:text-white"
  >
    <header class="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-dark-800">
      <nav class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <img
            :src="siteLogo || '/logo.svg'"
            alt="Logo"
            class="h-9 w-9 shrink-0 rounded-lg object-contain"
          />
          <span class="min-w-0 truncate text-base font-semibold">{{ siteName }}</span>
        </div>
        <div class="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
          <LocaleSwitcher />
          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-dark-400 dark:hover:bg-dark-800"
            :title="t('home.viewDocs')"
          >
            <Icon name="book" size="md" />
          </a>
          <router-link
            v-if="showModelPlazaEntry"
            to="/model-plaza"
            class="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-dark-400 dark:hover:bg-dark-800 dark:hover:text-white"
            :title="t('nav.modelPlaza')"
          >
            <Icon name="grid" size="md" />
            <span class="hidden sm:inline">{{ t('nav.modelPlaza') }}</span>
          </router-link>
          <button
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-dark-400 dark:hover:bg-dark-800"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            @click="toggleTheme"
          >
            <Icon v-if="isDark" name="sun" size="md" />
            <Icon v-else name="moon" size="md" />
          </button>
          <router-link
            :to="isAuthenticated ? dashboardPath : '/login'"
            class="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {{ isAuthenticated ? t('home.dashboard') : t('home.login') }}
          </router-link>
        </div>
      </nav>
    </header>

    <main class="flex min-w-0 flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div class="min-w-0 max-w-2xl text-center">
        <img
          :src="siteLogo || '/logo.svg'"
          alt="Logo"
          class="mx-auto mb-6 h-20 w-20 rounded-2xl object-contain"
        />
        <h1 class="[overflow-wrap:anywhere] text-3xl font-bold md:text-4xl">{{ siteName }}</h1>
        <p class="mt-4 whitespace-pre-wrap [overflow-wrap:anywhere] text-base text-gray-600 dark:text-dark-300">{{ siteSubtitle }}</p>
        <router-link
          :to="isAuthenticated ? dashboardPath : '/login'"
          class="mt-8 inline-flex min-h-10 items-center justify-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          {{ isAuthenticated ? t('home.goToDashboard') : t('home.login') }}
        </router-link>
      </div>
    </main>

    <footer class="min-w-0 border-t border-gray-200 px-4 py-5 text-center text-sm text-gray-500 [overflow-wrap:anywhere] sm:px-6 dark:border-dark-800 dark:text-dark-400">
      &copy; {{ currentYear }} {{ siteName }}
    </footer>
  </div>

  <!-- Default Home Page -->
  <div v-else data-testid="default-home" class="lp">
    <header class="lp-nav">
      <div class="lp-shell lp-nav-inner">
        <router-link to="/" class="lp-brand">
          <img :src="siteLogo || '/logo.svg'" alt="" class="lp-mark" />
          <span class="lp-brandname">{{ siteName }}</span>
        </router-link>

        <div class="lp-nav-actions">
          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="lp-navlink"
          >
            {{ t('home.docs') }}
          </a>
          <router-link v-if="showModelPlazaEntry" to="/model-plaza" class="lp-navlink">
            {{ t('nav.modelPlaza') }}
          </router-link>
          <LocaleSwitcher />
          <button
            type="button"
            class="lp-icon"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            @click="toggleTheme"
          >
            <Icon :name="isDark ? 'sun' : 'moon'" size="sm" />
          </button>
          <router-link :to="isAuthenticated ? dashboardPath : '/login'" class="lp-cta lp-cta-sm">
            {{ isAuthenticated ? t('home.dashboard') : t('home.login') }}
          </router-link>
        </div>
      </div>
    </header>

    <main>
      <!-- 主张：左边一句话，右边把产品本身摆出来 -->
      <section class="lp-shell lp-hero">
        <div class="lp-hero-copy">
          <p class="lp-eyebrow">{{ t('home.hero.eyebrow') }}</p>
          <h1 class="lp-display">{{ t('home.hero.title') }}</h1>
          <p class="lp-lede">{{ t('home.hero.description') }}</p>
          <div class="lp-actions">
            <router-link :to="isAuthenticated ? dashboardPath : '/login'" class="lp-cta">
              {{ isAuthenticated ? t('home.goToDashboard') : t('home.hero.start') }}
            </router-link>
            <a
              v-if="docUrl"
              :href="docUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="lp-ghost"
            >
              {{ t('home.viewDocs') }}
            </a>
          </div>
        </div>

        <div class="lp-hero-panel">
          <RequestLedger />
          <p class="lp-caption">{{ t('home.ledger.disclaimer') }}</p>
        </div>
      </section>

      <!-- 能力：规格表，不是卡片墙 -->
      <section class="lp-band">
        <div class="lp-shell">
          <div class="lp-spec">
            <article v-for="item in capabilities" :key="item.key" class="lp-spec-item">
              <p class="lp-eyebrow">{{ item.label }}</p>
              <h2 class="lp-spec-title">{{ item.title }}</h2>
              <p class="lp-spec-body">{{ item.desc }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- 治理：左图右词条 -->
      <section class="lp-band lp-band-sunken">
        <div class="lp-shell lp-govern">
          <div class="lp-govern-visual">
            <OrgScopeCard />
          </div>
          <div class="lp-govern-copy">
            <p class="lp-eyebrow">{{ t('home.governance.eyebrow') }}</p>
            <h2 class="lp-heading">{{ t('home.governance.title') }}</h2>
            <dl class="lp-defs">
              <div v-for="item in governance" :key="item.key" class="lp-def">
                <dt>{{ item.title }}</dt>
                <dd>{{ item.desc }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <!-- 接入：整块暗面板，请求和回执并排 -->
      <section class="lp-band">
        <div class="lp-shell">
          <div class="lp-integrate">
            <div class="lp-integrate-copy">
              <p class="lp-eyebrow">{{ t('home.integration.eyebrow') }}</p>
              <h2 class="lp-heading">{{ t('home.integration.title') }}</h2>
              <p class="lp-body">{{ t('home.integration.description') }}</p>
            </div>
            <div class="lp-code">
              <div class="lp-code-bar">
                <span>{{ t('home.integration.request') }}</span>
              </div>
              <pre class="lp-pre"><code>{{ integrationSnippet }}</code></pre>
              <div class="lp-code-bar lp-code-bar-foot">
                <span>{{ t('home.integration.returned') }}</span>
              </div>
              <dl class="lp-returned">
                <div v-for="field in returnedFields" :key="field.name">
                  <dt>{{ field.name }}</dt>
                  <dd>{{ field.note }}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <!-- 个人自助：安静收尾 -->
      <section class="lp-band lp-band-sunken">
        <div class="lp-shell lp-closer">
          <div>
            <h2 class="lp-heading">{{ t('home.personal.title') }}</h2>
            <p class="lp-body lp-closer-body">{{ t('home.personal.description') }}</p>
          </div>
          <router-link v-if="!isAuthenticated" to="/register" class="lp-ghost lp-ghost-lg">
            {{ t('home.register') }}
          </router-link>
        </div>
      </section>
    </main>

    <footer class="lp-foot">
      <div class="lp-shell lp-foot-inner">
        <span>&copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}</span>
        <a
          v-if="docUrl"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="lp-footlink"
        >
          {{ t('home.docs') }}
        </a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import RequestLedger from './home/RequestLedger.vue'
import OrgScopeCard from './home/OrgScopeCard.vue'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'

const { t } = useI18n()

const authStore = useAuthStore()
const appStore = useAppStore()

// Site settings - directly from appStore (already initialized from injected config)
const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API')
const siteLogo = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const siteSubtitle = computed(() => appStore.cachedPublicSettings?.site_subtitle || 'AI API Gateway Platform')
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')
const hasHomeContent = computed(() => homeContent.value.trim().length > 0)
const compactHomeEnabled = computed(() => appStore.cachedPublicSettings?.compact_home_enabled === true)
const modelPlazaEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza))

// Check if homeContent is a URL (for iframe display)
const isHomeContentUrl = computed(() => {
  const content = homeContent.value.trim()
  return content.startsWith('http://') || content.startsWith('https://')
})

// Theme
const isDark = ref(document.documentElement.classList.contains('dark'))

// GitHub URL
// 接入示例。用占位的模型名，不写具体厂商和型号。
const integrationSnippet = `curl https://your-domain.example/v1/chat/completions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "<model>", "messages": [{"role": "user", "content": "hi"}]}'`

const capabilities = computed(() =>
  (['unified', 'routing', 'metering', 'records'] as const).map((key) => ({
    key,
    label: t(`home.capabilities.${key}.label`),
    title: t(`home.capabilities.${key}.title`),
    desc: t(`home.capabilities.${key}.desc`)
  }))
)

// 调用打回来时随手就能拿到的东西，逐条列出来比一句「全量记录」有说服力
const returnedFields = computed(() =>
  (['organization', 'member', 'group', 'usage', 'cost'] as const).map((key) => ({
    name: t(`home.integration.fields.${key}.name`),
    note: t(`home.integration.fields.${key}.note`)
  }))
)

const governance = computed(() =>
  (['isolation', 'quota', 'scope', 'suspend'] as const).map((key) => ({
    key,
    title: t(`home.governance.${key}.title`),
    desc: t(`home.governance.${key}.desc`)
  }))
)

// Auth state
const isAuthenticated = computed(() => authStore.isAuthenticated)
const modelPlazaRequiresAuth = computed(
  () => appStore.cachedPublicSettings?.model_plaza_require_auth === true,
)
const showModelPlazaEntry = computed(
  () => modelPlazaEnabled.value && (isAuthenticated.value || !modelPlazaRequiresAuth.value),
)
const isAdmin = computed(() => authStore.isAdmin)
const dashboardPath = computed(() => isAdmin.value ? '/admin/dashboard' : '/dashboard')
// Current year for footer
const currentYear = computed(() => new Date().getFullYear())

// Toggle theme
function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

// Initialize theme
function initTheme() {
  const savedTheme = localStorage.getItem('theme')
  if (
    savedTheme === 'dark' ||
    (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
}

onMounted(() => {
  initTheme()

  // Check auth state
  authStore.checkAuth()

  // Ensure public settings are loaded (will use cache if already loaded from injected config)
  if (!appStore.publicSettingsLoaded) {
    appStore.fetchPublicSettings()
  }
})
</script>

<style scoped>
/* 落地页自成一套。控制台那套是给盯八小时的人用的，
   落地页只有几秒钟建立信任，两者的密度和对比度诉求不同。 */
.lp {
  --paper: #fafaf9;
  --card: #ffffff;
  --sunken: #f5f4f2;
  --rule: #e7e5e4;
  --rule-soft: #efedeb;
  --ink: #1c1917;
  --body: #44403c;
  --muted: #78716c;
  --subtle: #a8a29e;
  --navy: #1b4ba8;
  --navy-hover: #163c88;
  --abyss: #0a1938;

  display: flex;
  min-height: 100vh;
  flex-direction: column;
  background: var(--paper);
  color: var(--body);
}

:global(.dark) .lp {
  --paper: #171614;
  --card: #1f1d1b;
  --sunken: #12110f;
  --rule: #2c2926;
  --rule-soft: #26231f;
  --ink: #f5f4f2;
  --body: #d4d0cb;
  --muted: #96918b;
  --subtle: #706b65;
  --navy: #5080e2;
  --navy-hover: #8eadeb;
}

.lp-shell {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px;
}

/* ---------- 通用排版 ---------- */
/* 等宽是这套页面的声音：所有眉标、标签和数字都走它。
   对一个 API 网关来说这是行业母语，不是装饰。 */
.lp-eyebrow {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.lp-display {
  margin: 18px 0 0;
  font-size: clamp(2.25rem, 5.2vw, 3.75rem);
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: -0.035em;
  color: var(--ink);
}

.lp-heading {
  margin: 12px 0 0;
  font-size: clamp(1.5rem, 2.6vw, 2rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.022em;
  color: var(--ink);
}

.lp-lede {
  max-width: 34rem;
  margin: 20px 0 0;
  font-size: 1.0625rem;
  line-height: 1.65;
  color: var(--muted);
}

.lp-body {
  margin: 14px 0 0;
  max-width: 34rem;
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--muted);
}

.lp-caption {
  margin: 12px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--muted);
}

/* ---------- 按钮 ---------- */
.lp-cta,
.lp-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 22px;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}

.lp-cta {
  background: var(--navy);
  color: #fff;
}

.lp-cta:hover {
  background: var(--navy-hover);
}

:global(.dark) .lp-cta {
  color: #0a1938;
}

.lp-cta-sm {
  height: 34px;
  padding: 0 14px;
  font-size: 0.875rem;
}

.lp-ghost {
  border: 1px solid var(--rule);
  color: var(--ink);
}

.lp-ghost:hover {
  border-color: var(--subtle);
}

.lp-ghost-lg {
  flex-shrink: 0;
}

.lp-cta:focus-visible,
.lp-ghost:focus-visible,
.lp-navlink:focus-visible,
.lp-icon:focus-visible,
.lp-footlink:focus-visible,
.lp-brand:focus-visible {
  outline: 2px solid var(--navy);
  outline-offset: 2px;
}

/* ---------- 顶栏 ---------- */
.lp-nav {
  position: sticky;
  top: 0;
  z-index: 30;
  border-bottom: 1px solid var(--rule);
  background: var(--paper);
}

.lp-nav-inner {
  display: flex;
  height: 60px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.lp-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.lp-mark {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  object-fit: contain;
}

.lp-brandname {
  font-size: 0.9375rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ink);
}

.lp-nav-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.lp-navlink {
  padding: 0 10px;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 34px;
  color: var(--muted);
  text-decoration: none;
  border-radius: 6px;
}

.lp-navlink:hover {
  color: var(--ink);
}

.lp-icon {
  display: inline-flex;
  height: 34px;
  width: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--muted);
  background: transparent;
  border: 0;
  cursor: pointer;
}

.lp-icon:hover {
  color: var(--ink);
}

/* ---------- 主张 ---------- */
.lp-hero {
  display: grid;
  gap: 48px;
  padding-top: 72px;
  padding-bottom: 80px;
}

.lp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 32px;
}

@media (min-width: 960px) {
  .lp-hero {
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    align-items: center;
    gap: 64px;
    padding-top: 96px;
    padding-bottom: 104px;
  }
}

/* ---------- 区块骨架 ---------- */
.lp-band {
  border-top: 1px solid var(--rule);
  padding: 72px 0;
}

.lp-band-sunken {
  background: var(--sunken);
}

/* ---------- 能力规格表 ---------- */
.lp-spec {
  display: grid;
  gap: 32px;
}

.lp-spec-item {
  padding-top: 20px;
  border-top: 2px solid var(--ink);
}

.lp-spec-title {
  margin: 14px 0 0;
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--ink);
}

.lp-spec-body {
  margin: 10px 0 0;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--muted);
}

@media (min-width: 720px) {
  .lp-spec {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 36px 40px;
  }
}

@media (min-width: 1000px) {
  .lp-spec {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

/* ---------- 治理 ---------- */
.lp-govern {
  display: grid;
  gap: 44px;
}

@media (min-width: 960px) {
  .lp-govern {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    align-items: center;
    gap: 72px;
  }
}

.lp-defs {
  margin: 28px 0 0;
}

.lp-def + .lp-def {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--rule);
}

.lp-def dt {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ink);
}

.lp-def dd {
  margin: 6px 0 0;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--muted);
}

/* ---------- 接入 ---------- */
.lp-integrate {
  display: grid;
  gap: 36px;
}

@media (min-width: 960px) {
  .lp-integrate {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    align-items: start;
    gap: 64px;
  }
}

.lp-code {
  overflow: hidden;
  border-radius: 12px;
  background: var(--abyss);
}

.lp-code-bar {
  padding: 11px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6b7c9e;
}

.lp-code-bar-foot {
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  border-bottom: 0;
}

.lp-pre {
  margin: 0;
  overflow-x: auto;
  padding: 18px 16px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.75;
  color: #c3cee4;
}

.lp-returned {
  margin: 0;
  padding: 6px 16px 16px;
}

.lp-returned > div {
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: 7px 0;
}

.lp-returned dt {
  min-width: 8.5rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #7fa4ef;
}

.lp-returned dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: #8fa0bd;
}

/* ---------- 收尾 ---------- */
.lp-closer {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.lp-closer-body {
  margin-top: 10px;
}

@media (min-width: 720px) {
  .lp-closer {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 40px;
  }
}

/* ---------- 页脚 ---------- */
.lp-foot {
  border-top: 1px solid var(--rule);
  padding: 28px 0;
}

.lp-foot-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 0.8125rem;
  color: var(--muted);
  text-align: center;
}

@media (min-width: 640px) {
  .lp-foot-inner {
    flex-direction: row;
    justify-content: space-between;
    text-align: left;
  }
}

.lp-footlink {
  color: var(--muted);
  text-decoration: none;
}

.lp-footlink:hover {
  color: var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  .lp * {
    transition-duration: 1ms !important;
  }
}
</style>
