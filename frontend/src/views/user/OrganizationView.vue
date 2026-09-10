<template>
  <AppLayout>
    <div class="space-y-6">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <h1 class="truncate text-xl font-semibold text-gray-900 dark:text-white">
            {{ organization?.name || t('organization.title') }}
          </h1>
          <span
            v-if="organization?.is_owner"
            class="mt-2 inline-flex rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
          >
            {{ t('organization.owner') }}
          </span>
        </div>

        <button
          v-if="organization?.is_owner"
          type="button"
          class="btn btn-primary shrink-0"
          :disabled="creating"
          @click="createInvitation"
        >
          <Icon :name="creating ? 'refresh' : 'plus'" size="sm" :class="{ 'animate-spin': creating }" />
          <span>{{ creating ? t('organization.creatingInvitation') : t('organization.createInvitation') }}</span>
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-16" aria-live="polite">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
      </div>

      <div
        v-else-if="loadError"
        class="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-900/20"
      >
        <p class="text-sm text-red-700 dark:text-red-300">{{ loadError }}</p>
        <button type="button" class="btn btn-secondary btn-sm mt-4" @click="loadOrganization">
          <Icon name="refresh" size="sm" />
          <span>{{ t('organization.retry') }}</span>
        </button>
      </div>

      <div
        v-else-if="!organization"
        class="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center text-sm text-gray-500 dark:border-dark-700 dark:text-dark-400"
      >
        {{ t('organization.noOrganization') }}
      </div>

      <section v-else-if="organization.is_owner" class="card overflow-hidden">
        <div class="border-b border-gray-200 px-5 py-4 dark:border-dark-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('organization.invitations') }}
          </h2>
        </div>

        <div
          v-if="invitations.length === 0"
          class="px-5 py-12 text-center text-sm text-gray-500 dark:text-dark-400"
        >
          {{ t('organization.invitationEmpty') }}
        </div>

        <ul v-else class="divide-y divide-gray-100 dark:divide-dark-800">
          <li
            v-for="invitation in invitations"
            :key="invitation.id"
            class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 flex-1">
              <code class="block break-all text-sm font-semibold text-gray-900 dark:text-white">
                {{ invitation.code }}
              </code>
              <div class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-dark-400">
                <span>{{ t('organization.createdAt') }}: {{ formatDateTime(invitation.created_at) }}</span>
                <span>
                  {{ t('organization.expiresAt') }}:
                  {{ invitation.expires_at ? formatDateTime(invitation.expires_at) : t('organization.neverExpires') }}
                </span>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <span :class="statusClass(invitation)" class="rounded-full px-2.5 py-1 text-xs font-medium">
                {{ t(`organization.status.${effectiveStatus(invitation)}`) }}
              </span>
              <button
                type="button"
                class="btn btn-secondary btn-sm h-9 w-9 p-0"
                :title="t('common.copy')"
                @click="copyInvitation(invitation.code)"
              >
                <Icon name="copy" size="sm" />
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import organizationAPI from '@/api/organization'
import type { OrganizationInvitation, OrganizationSummary } from '@/types'
import { useAppStore } from '@/stores/app'
import { useClipboard } from '@/composables/useClipboard'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()
const appStore = useAppStore()
const { copyToClipboard } = useClipboard()

const organization = ref<OrganizationSummary | null>(null)
const invitations = ref<OrganizationInvitation[]>([])
const loading = ref(true)
const creating = ref(false)
const loadError = ref('')

function effectiveStatus(invitation: OrganizationInvitation): OrganizationInvitation['status'] {
  if (
    invitation.status === 'unused' &&
    invitation.expires_at &&
    new Date(invitation.expires_at).getTime() <= Date.now()
  ) {
    return 'expired'
  }
  return invitation.status
}

function statusClass(invitation: OrganizationInvitation): string {
  switch (effectiveStatus(invitation)) {
    case 'unused':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'used':
      return 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-300'
    case 'disabled':
    case 'expired':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  }
}

async function loadOrganization(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    organization.value = await organizationAPI.getCurrentOrganization()
    invitations.value = organization.value?.is_owner
      ? await organizationAPI.listOrganizationInvitations()
      : []
  } catch (error) {
    loadError.value = extractApiErrorMessage(error, t('organization.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function createInvitation(): Promise<void> {
  if (creating.value) return
  creating.value = true
  try {
    const invitation = await organizationAPI.createOrganizationInvitation()
    invitations.value = [invitation, ...invitations.value]
  } catch (error) {
    appStore.showError(extractApiErrorMessage(error, t('organization.createFailed')))
  } finally {
    creating.value = false
  }
}

async function copyInvitation(code: string): Promise<void> {
  await copyToClipboard(code, t('organization.invitationCopied'))
}

onMounted(() => {
  void loadOrganization()
})
</script>
