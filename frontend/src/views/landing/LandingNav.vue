<template>
  <header class="lp-nav">
    <div class="lp-shell lp-nav-inner">
      <router-link to="/" class="lp-brand">
        <img :src="siteLogo || '/logo.svg'" alt="" class="lp-mark" />
        <span class="lp-brandname">{{ siteName }}</span>
      </router-link>

      <nav class="lp-nav-links">
        <router-link :to="sectionLink('capabilities')" class="lp-navlink">
          {{ t('landing.nav.product') }}
        </router-link>
        <router-link :to="sectionLink('cases')" class="lp-navlink">
          {{ t('landing.nav.scenarios') }}
        </router-link>
        <router-link to="/pricing" class="lp-navlink" :class="{ 'is-active': current === 'pricing' }">
          {{ t('landing.nav.pricing') }}
        </router-link>
        <router-link
          v-if="showStatus"
          to="/status"
          class="lp-navlink"
          :class="{ 'is-active': current === 'status' }"
        >
          {{ t('landing.nav.status') }}
        </router-link>
        <router-link
          v-if="showModelPlaza"
          to="/model-plaza"
          class="lp-navlink"
          :class="{ 'is-active': current === 'models' }"
        >
          {{ t('landing.nav.models') }}
        </router-link>
        <a
          v-if="docUrl"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="lp-navlink"
        >
          {{ t('landing.nav.docs') }}
        </a>
      </nav>

      <div class="lp-nav-actions">
        <LocaleSwitcher />
        <button
          type="button"
          class="lp-icon"
          :title="isDark ? t('landing.nav.lightMode') : t('landing.nav.darkMode')"
          @click="toggleTheme"
        >
          <Icon :name="isDark ? 'sun' : 'moon'" size="sm" />
        </button>
        <router-link :to="isAuthenticated ? dashboardPath : '/login'" class="lp-navlink">
          {{ isAuthenticated ? t('landing.nav.console') : t('landing.nav.login') }}
        </router-link>
        <router-link to="/pricing" class="lp-cta lp-cta-sm">
          {{ t('landing.nav.tryNow') }}
        </router-link>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import { useLandingChrome } from './useLandingChrome'

/** 官网顶栏。首页和定价页共用，导航项一处维护。 */
defineProps<{
  /** 当前页，用来给对应导航项加高亮 */
  current?: 'home' | 'pricing' | 'models' | 'status'
}>()

const { t } = useI18n()
const {
  siteName,
  siteLogo,
  docUrl,
  showModelPlaza,
  showStatus,
  isAuthenticated,
  dashboardPath,
  isDark,
  toggleTheme
} = useLandingChrome()

/** 首页内部锚点。不在首页时先回首页再定位。 */
const sectionLink = (id: string) => ({ path: '/', hash: `#${id}` })
</script>
