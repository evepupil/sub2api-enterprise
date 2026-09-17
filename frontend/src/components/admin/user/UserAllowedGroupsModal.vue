<template>
  <BaseDialog :show="show" :title="t('admin.users.groupConfig')" width="wide" @close="$emit('close')">
    <div v-if="user" class="space-y-6">
      <!-- 用户信息头部 -->
      <div class="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-primary-50 to-primary-100 p-5 dark:from-primary-900/30 dark:to-primary-800/20">
        <div class="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm dark:bg-dark-700">
          <span class="text-2xl font-semibold text-primary-600 dark:text-primary-400">{{ user.email.charAt(0).toUpperCase() }}</span>
        </div>
        <div class="flex-1">
          <p class="text-lg font-semibold text-content-strong">{{ user.email }}</p>
          <p class="mt-1 text-sm text-content-muted">{{ t('admin.users.groupConfigHint', { email: user.email }) }}</p>
        </div>
      </div>

      <!-- 分组范围选择区（与组织管理共用） -->
      <GroupScopePicker
        v-model:selected-ids="selectedGroupIds"
        v-model:restrict-public-groups="restrictPublicGroups"
        v-model:group-rates="groupRates"
        :groups="groups"
        :loading="loading"
        show-rate-editor
      />
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button @click="$emit('close')" class="btn btn-secondary px-5">{{ t('common.cancel') }}</button>
        <button @click="handleSave" :disabled="submitting" class="btn btn-primary px-6">
          <svg v-if="submitting" class="-ml-1 mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ submitting ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { AdminUser, Group } from '@/types'
import BaseDialog from '@/components/common/BaseDialog.vue'
import GroupScopePicker from '@/components/admin/group/GroupScopePicker.vue'

const props = defineProps<{ show: boolean; user: AdminUser | null }>()
const emit = defineEmits(['close', 'success'])
const { t } = useI18n()
const appStore = useAppStore()

const groups = ref<Group[]>([])
const selectedGroupIds = ref<number[]>([])
const groupRates = ref<Record<number, number | null>>({})
const originalGroupRates = ref<Record<number, number>>({}) // 记录原始专属倍率，用于检测删除
const loading = ref(false)
const submitting = ref(false)
const restrictPublicGroups = ref(false)

watch(
  () => props.show,
  (v) => {
    if (v && props.user) {
      load()
    }
  }
)

const load = async () => {
  loading.value = true
  try {
    const res = await adminAPI.groups.list(1, 1000)
    // 只显示标准类型且活跃的分组
    groups.value = res.items.filter((g) => g.subscription_type === 'standard' && g.status === 'active')

    const userAllowedGroups = props.user?.allowed_groups || []
    const userGroupRates = props.user?.group_rates || {}
    restrictPublicGroups.value = props.user?.restrict_public_groups ?? false

    // 保存原始专属倍率，用于检测删除操作
    originalGroupRates.value = { ...userGroupRates }

    selectedGroupIds.value = [...userAllowedGroups]
    groupRates.value = { ...userGroupRates }
  } catch (error) {
    console.error('Failed to load groups:', error)
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  if (!props.user) return
  submitting.value = true

  try {
    // 构建 allowed_groups：专属分组中被勾选的，以及开启限制后被勾选的公开分组。
    // 未开启限制时不写入公开分组，保持该表"额外授予"的原有语义。
    const exclusiveIds = groups.value.filter((g) => g.is_exclusive).map((g) => g.id)
    const allowedGroups = selectedGroupIds.value.filter(
      (id) => exclusiveIds.includes(id) || restrictPublicGroups.value
    )

    // 构建 group_rates
    // - 有新专属倍率: 设置为该值
    // - 原本有专属倍率但现在被清空: 设置为 null（表示删除）
    const groupRatesToSave: Record<number, number | null> = {}
    for (const [idText, rate] of Object.entries(groupRates.value)) {
      const groupId = Number(idText)
      const hadOriginalRate = originalGroupRates.value[groupId] !== undefined
      if (rate !== null && rate !== undefined) {
        groupRatesToSave[groupId] = rate
      } else if (hadOriginalRate) {
        groupRatesToSave[groupId] = null
      }
    }

    await adminAPI.users.update(props.user.id, {
      allowed_groups: allowedGroups,
      restrict_public_groups: restrictPublicGroups.value,
      group_rates: Object.keys(groupRatesToSave).length > 0 ? groupRatesToSave : undefined,
    })

    appStore.showSuccess(t('admin.users.groupConfigUpdated'))
    emit('success')
    emit('close')
  } catch (error) {
    console.error('Failed to update user group config:', error)
  } finally {
    submitting.value = false
  }
}
</script>
