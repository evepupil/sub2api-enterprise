import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useAppStore, useAuthStore } from '@/stores'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'

/**
 * 官网页面共用的那几样：站点信息、登录状态、文档链接、主题开关。
 *
 * 站名、Logo、文档地址全部走后台的公开设置，这样换品牌不用改代码，
 * 自部署的客户填自己的就行。
 */
export interface LandingChrome {
  siteName: ComputedRef<string>
  siteLogo: ComputedRef<string>
  docUrl: ComputedRef<string>
  contactEmail: ComputedRef<string>
  showModelPlaza: ComputedRef<boolean>
  showStatus: ComputedRef<boolean>
  isAuthenticated: ComputedRef<boolean>
  dashboardPath: ComputedRef<string>
  currentYear: ComputedRef<number>
  isDark: Ref<boolean>
  toggleTheme: () => void
}

export function useLandingChrome(): LandingChrome {
  const appStore = useAppStore()
  const authStore = useAuthStore()

  const settings = computed(() => appStore.cachedPublicSettings)

  const siteName = computed(() => settings.value?.site_name || appStore.siteName || 'Sub2API')

  const siteLogo = computed(() =>
    sanitizeUrl(settings.value?.site_logo || appStore.siteLogo || '', {
      allowRelative: true,
      allowDataUrl: true
    })
  )

  const docUrl = computed(() => sanitizeUrl(settings.value?.doc_url || appStore.docUrl || ''))

  // 企业咨询先走邮箱，后台没配就退回一个占位地址，上线前必须填。
  const contactEmail = computed(
    () => (settings.value as Record<string, unknown> | null)?.contact_email as string || ''
  )

  const isAuthenticated = computed(() => authStore.isAuthenticated)

  const modelPlazaRequiresAuth = computed(() => settings.value?.model_plaza_require_auth === true)

  const showModelPlaza = computed(
    () =>
      isFeatureFlagEnabled(FeatureFlags.modelPlaza) &&
      (isAuthenticated.value || !modelPlazaRequiresAuth.value)
  )

  // 状态页默认关闭。开关没打开时不放导航入口，避免点进去看到空页。
  const showStatus = computed(() => settings.value?.public_status_enabled === true)

  const dashboardPath = computed(() => (authStore.isAdmin ? '/admin/dashboard' : '/dashboard'))

  const currentYear = computed(() => new Date().getFullYear())

  const isDark = ref(document.documentElement.classList.contains('dark'))

  const toggleTheme = (): void => {
    isDark.value = !isDark.value
    document.documentElement.classList.toggle('dark', isDark.value)
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  }

  return {
    siteName,
    siteLogo,
    docUrl,
    contactEmail,
    showModelPlaza,
    showStatus,
    isAuthenticated,
    dashboardPath,
    currentYear,
    isDark,
    toggleTheme
  }
}
