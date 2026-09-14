<template>
  <footer class="lp-foot">
    <div class="lp-shell">
      <div class="lp-foot-top">
        <div class="lp-foot-brand">
          <router-link to="/" class="lp-brand">
            <img :src="siteLogo || '/logo.svg'" alt="" class="lp-mark" />
            <span class="lp-brandname">{{ siteName }}</span>
          </router-link>
          <p class="lp-foot-desc">{{ t('landing.footer.blurb') }}</p>
        </div>

        <div>
          <p class="lp-foot-col-title">{{ t('landing.footer.product') }}</p>
          <ul class="lp-foot-list">
            <li><router-link to="/pricing" class="lp-footlink">{{ t('landing.nav.pricing') }}</router-link></li>
            <li v-if="showModelPlaza">
              <router-link to="/model-plaza" class="lp-footlink">{{ t('landing.nav.models') }}</router-link>
            </li>
            <li v-if="showStatus">
              <router-link to="/status" class="lp-footlink">{{ t('landing.nav.status') }}</router-link>
            </li>
            <li v-if="docUrl">
              <a :href="docUrl" target="_blank" rel="noopener noreferrer" class="lp-footlink">
                {{ t('landing.nav.docs') }}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p class="lp-foot-col-title">{{ t('landing.footer.account') }}</p>
          <ul class="lp-foot-list">
            <li><router-link to="/login" class="lp-footlink">{{ t('landing.nav.login') }}</router-link></li>
            <li><router-link to="/register" class="lp-footlink">{{ t('landing.footer.register') }}</router-link></li>
          </ul>
        </div>

        <div>
          <p class="lp-foot-col-title">{{ t('landing.footer.contact') }}</p>
          <ul class="lp-foot-list">
            <li>
              <a :href="`mailto:${salesEmail}`" class="lp-footlink">{{ salesEmail }}</a>
            </li>
          </ul>
        </div>
      </div>

      <div class="lp-foot-legal">
        <span>&copy; {{ currentYear }} {{ companyName }}. {{ t('landing.footer.rights') }}</span>
        <span v-if="icpNumber">{{ icpNumber }}</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLandingChrome } from './useLandingChrome'
import { SALES_EMAIL, COMPANY_NAME, ICP_NUMBER } from './landingContent'

/** 官网页脚。首页和定价页共用。 */
const { t } = useI18n()
const { siteName, siteLogo, docUrl, showModelPlaza, showStatus, currentYear } = useLandingChrome()

const salesEmail = computed(() => SALES_EMAIL)
// 公司主体没填就退回站点名，至少不出现空白
const companyName = computed(() => COMPANY_NAME || siteName.value)
const icpNumber = computed(() => ICP_NUMBER)
</script>
