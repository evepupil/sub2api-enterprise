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
  <div v-else data-testid="default-home" class="flex min-h-screen flex-col bg-surface">
    <!-- 顶栏 -->
    <header class="border-b border-line-subtle">
      <nav class="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div class="flex items-center gap-2.5">
          <img
            :src="siteLogo || '/logo.svg'"
            alt=""
            class="h-7 w-7 rounded-lg object-contain"
          />
          <span class="text-base font-semibold text-content-strong">{{ siteName }}</span>
        </div>

        <div class="flex items-center gap-1">
          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost"
          >
            {{ t('home.docs') }}
          </a>
          <router-link v-if="showModelPlazaEntry" to="/model-plaza" class="btn btn-ghost">
            {{ t('nav.modelPlaza') }}
          </router-link>
          <LocaleSwitcher />
          <button
            class="btn btn-ghost btn-icon"
            :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
            @click="toggleTheme"
          >
            <Icon :name="isDark ? 'sun' : 'moon'" size="sm" />
          </button>
          <router-link
            :to="isAuthenticated ? dashboardPath : '/login'"
            class="btn btn-primary ml-1"
          >
            {{ isAuthenticated ? t('home.dashboard') : t('home.login') }}
          </router-link>
        </div>
      </nav>
    </header>

    <main class="flex-1">
      <!-- 主张 -->
      <section class="mx-auto max-w-6xl px-6 py-16 lg:py-24">
        <div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h1 class="text-3xl font-semibold leading-tight text-content-strong sm:text-4xl">
              {{ t('home.hero.title') }}
            </h1>
            <p class="mt-4 max-w-xl text-base leading-relaxed text-content-muted">
              {{ t('home.hero.description') }}
            </p>
            <div class="mt-8 flex flex-wrap items-center gap-2">
              <router-link
                :to="isAuthenticated ? dashboardPath : '/login'"
                class="btn btn-primary btn-lg"
              >
                {{ isAuthenticated ? t('home.goToDashboard') : t('home.hero.start') }}
              </router-link>
              <a
                v-if="docUrl"
                :href="docUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-secondary btn-lg"
              >
                {{ t('home.viewDocs') }}
              </a>
            </div>
          </div>

          <!-- 一次调用长什么样。示意，不是实测数据 -->
          <div class="card card-glow overflow-hidden">
            <div class="border-b border-line-subtle px-4 py-2.5">
              <span class="font-mono text-xs text-content-muted">POST /v1/chat/completions</span>
            </div>
            <div class="space-y-1.5 px-4 py-4 font-mono text-xs leading-relaxed">
              <div class="text-content-muted">
                Authorization: Bearer
                <span class="text-content">sk-••••••••••••</span>
              </div>
              <div class="text-content-muted">
                X-Organization:
                <span class="text-content">acme</span>
              </div>
            </div>
            <div
              class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-subtle bg-surface-sunken px-4 py-3 font-mono text-xs"
            >
              <span class="font-semibold text-emerald-600 dark:text-emerald-400">200</span>
              <span class="text-content-muted">1,843 tokens</span>
              <span class="text-content-muted">$0.0092</span>
              <span class="text-content-muted">zhangsan@acme</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 平台能力 -->
      <section class="border-t border-line-subtle">
        <div class="mx-auto max-w-6xl px-6 py-16">
          <h2 class="mb-8 text-lg font-semibold text-content-strong">
            {{ t('home.capabilities.title') }}
          </h2>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="item in capabilities" :key="item.key" class="card p-5">
              <h3 class="text-sm font-semibold text-content-strong">{{ item.title }}</h3>
              <p class="mt-2 text-sm leading-relaxed text-content-muted">{{ item.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 组织治理 -->
      <section class="border-t border-line-subtle bg-surface-sunken">
        <div class="mx-auto max-w-6xl px-6 py-16">
          <h2 class="mb-8 text-lg font-semibold text-content-strong">
            {{ t('home.governance.title') }}
          </h2>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="item in governance" :key="item.key" class="card p-5">
              <h3 class="text-sm font-semibold text-content-strong">{{ item.title }}</h3>
              <p class="mt-2 text-sm leading-relaxed text-content-muted">{{ item.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 接入方式 -->
      <section class="border-t border-line-subtle">
        <div class="mx-auto max-w-6xl px-6 py-16">
          <h2 class="text-lg font-semibold text-content-strong">
            {{ t('home.integration.title') }}
          </h2>
          <p class="mt-2 text-sm text-content-muted">{{ t('home.integration.description') }}</p>
          <pre class="code-block mt-6 leading-relaxed"><code>{{ integrationSnippet }}</code></pre>
        </div>
      </section>

      <!-- 个人也能用 -->
      <section class="border-t border-line-subtle">
        <div
          class="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-12 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 class="text-lg font-semibold text-content-strong">
              {{ t('home.personal.title') }}
            </h2>
            <p class="mt-1 max-w-xl text-sm text-content-muted">
              {{ t('home.personal.description') }}
            </p>
          </div>
          <router-link
            v-if="!isAuthenticated"
            to="/register"
            class="btn btn-secondary btn-lg shrink-0"
          >
            {{ t('home.register') }}
          </router-link>
        </div>
      </section>
    </main>

    <footer class="border-t border-line-subtle">
      <div
        class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-content-muted sm:flex-row"
      >
        <p>&copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}</p>
        <a
          v-if="docUrl"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="transition-colors hover:text-content-strong"
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
    title: t(`home.capabilities.${key}.title`),
    desc: t(`home.capabilities.${key}.desc`)
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
