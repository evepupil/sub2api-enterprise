<template>
  <div class="space-y-6">
    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-12">
      <svg class="h-10 w-10 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <div v-else class="space-y-6">
      <!-- 专属分组区域 -->
      <div v-if="exclusiveGroups.length > 0">
        <div class="mb-3 flex items-center gap-2">
          <div class="h-1.5 w-1.5 rounded-full bg-purple-500"></div>
          <h4 class="text-sm font-semibold text-content">{{ t('admin.users.exclusiveGroups') }}</h4>
          <span class="text-xs text-gray-400">({{ selectedExclusiveCount }}/{{ exclusiveGroups.length }})</span>
        </div>
        <div class="grid gap-3">
          <div
            v-for="group in exclusiveGroups"
            :key="group.id"
            class="group relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-200"
            :class="isGroupSelected(group)
              ? 'border-primary-400 bg-primary-50/50 shadow-sm dark:border-primary-500 dark:bg-primary-900/20'
              : 'border-gray-200 bg-white hover:border-line-strong dark:bg-dark-800 dark:hover:border-dark-500'"
          >
            <div class="flex items-center gap-4">
              <!-- 复选框 -->
              <div class="flex-shrink-0">
                <label class="relative flex h-6 w-6 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    :checked="isGroupSelected(group)"
                    class="peer sr-only"
                    @change="toggleExclusiveGroup(group.id)"
                  />
                  <div class="h-5 w-5 rounded-md border-2 border-gray-300 transition-all peer-checked:border-primary-500 peer-checked:bg-primary-500 dark:border-dark-500 peer-checked:dark:border-primary-500">
                    <svg v-if="isGroupSelected(group)" class="h-full w-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </label>
              </div>

              <!-- 分组信息 -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-base font-semibold text-content-strong">{{ group.name }}</span>
                  <span class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                    {{ t('admin.groups.exclusive') }}
                  </span>
                </div>
                <div class="mt-1.5 flex items-center gap-3 text-sm">
                  <span class="inline-flex items-center gap-1 text-content-muted">
                    <PlatformIcon :platform="group.platform" size="xs" />
                    <span>{{ group.platform }}</span>
                  </span>
                  <span class="text-gray-300 dark:text-dark-500">•</span>
                  <span class="text-content-muted">
                    {{ t('admin.users.defaultRate') }}: <span class="font-medium text-content">{{ group.rate_multiplier }}x</span>
                  </span>
                </div>
              </div>

              <!-- 专属倍率输入（仅用户级配置需要，组织分组范围不涉及倍率） -->
              <div v-if="showRateEditor" class="flex flex-shrink-0 items-center gap-3">
                <label class="text-sm font-medium text-content-muted">{{ t('admin.users.customRate') }}</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  :value="groupRateValue(group.id)"
                  :placeholder="String(group.rate_multiplier)"
                  class="hide-spinner w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-dark-500 dark:bg-dark-700 dark:focus:border-primary-500"
                  @input="updateGroupRate(group.id, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 公开分组区域 -->
      <div v-if="publicGroups.length > 0">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <div class="h-1.5 w-1.5 rounded-full bg-green-500"></div>
          <h4 class="text-sm font-semibold text-content">
            {{ restrictPublicGroups ? t('admin.users.publicGroupsRestricted') : t('admin.users.publicGroups') }}
          </h4>
          <span class="text-xs text-gray-400">({{ publicGroups.length }})</span>
          <label class="ml-auto flex cursor-pointer items-center gap-2 text-sm text-content-muted">
            <input
              type="checkbox"
              :checked="restrictPublicGroups"
              class="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-dark-500"
              @change="toggleRestrictPublicGroups"
            />
            {{ t('admin.users.restrictPublicGroups') }}
          </label>
        </div>
        <p class="mb-3 text-xs text-content-muted">{{ t('admin.users.restrictPublicGroupsHint') }}</p>
        <div class="grid gap-3">
          <div
            v-for="group in publicGroups"
            :key="group.id"
            class="relative overflow-hidden rounded-xl border-2 border-green-200 bg-green-50/50 p-4 dark:border-green-800/50 dark:bg-green-900/10"
          >
            <div class="flex items-center gap-4">
              <!-- 未开启限制时公开分组恒可用，此处仅作展示；开启后才是真实开关 -->
              <div class="flex-shrink-0">
                <input
                  v-if="restrictPublicGroups"
                  type="checkbox"
                  :checked="isGroupSelected(group)"
                  class="h-5 w-5 cursor-pointer rounded-md border-2 border-green-400 text-green-600 focus:ring-green-500 dark:border-green-600"
                  @change="togglePublicGroup(group.id)"
                />
                <div
                  v-else
                  class="flex h-5 w-5 items-center justify-center rounded-md border-2 border-green-400 bg-green-500 dark:border-green-600 dark:bg-green-600"
                >
                  <svg class="h-full w-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <!-- 分组信息 -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-base font-semibold text-content-strong">{{ group.name }}</span>
                </div>
                <div class="mt-1.5 flex items-center gap-3 text-sm">
                  <span class="inline-flex items-center gap-1 text-content-muted">
                    <PlatformIcon :platform="group.platform" size="xs" />
                    <span>{{ group.platform }}</span>
                  </span>
                  <span class="text-gray-300 dark:text-dark-500">•</span>
                  <span class="text-content-muted">
                    {{ t('admin.users.defaultRate') }}: <span class="font-medium text-content">{{ group.rate_multiplier }}x</span>
                  </span>
                </div>
              </div>

              <!-- 专属倍率输入（仅用户级配置需要，组织分组范围不涉及倍率） -->
              <div v-if="showRateEditor" class="flex flex-shrink-0 items-center gap-3">
                <label class="text-sm font-medium text-content-muted">{{ t('admin.users.customRate') }}</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  :value="groupRateValue(group.id)"
                  :placeholder="String(group.rate_multiplier)"
                  class="hide-spinner w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-dark-500 dark:bg-dark-700 dark:focus:border-primary-500"
                  @input="updateGroupRate(group.id, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 无分组提示 -->
      <div v-if="groups.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-sunken">
          <svg class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <p class="text-content-muted">{{ t('common.noGroupsAvailable') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import type { Group } from '@/types'

// 分组范围选择器：用户管理与组织管理共用的分组卡片选择区。
// 勾选语义与后端一致——专属分组始终按勾选生效；
// 公开分组在未开启限制时恒可用（仅展示），开启限制后按勾选生效。
const props = withDefaults(
  defineProps<{
    groups: Group[]
    loading?: boolean
    selectedIds: number[]
    restrictPublicGroups: boolean
    /** 用户级配置才有的专属倍率编辑行 */
    showRateEditor?: boolean
    /** 当前生效的专属倍率表，仅 showRateEditor 时读取 */
    groupRates?: Record<number, number | null>
  }>(),
  {
    loading: false,
    showRateEditor: false,
    groupRates: () => ({})
  }
)

const emit = defineEmits<{
  (e: 'update:selectedIds', ids: number[]): void
  (e: 'update:restrictPublicGroups', value: boolean): void
  (e: 'update:groupRates', rates: Record<number, number | null>): void
}>()

const { t } = useI18n()

const exclusiveGroups = computed(() => props.groups.filter((g) => g.is_exclusive))
const publicGroups = computed(() => props.groups.filter((g) => !g.is_exclusive))

const selectedExclusiveCount = computed(
  () => exclusiveGroups.value.filter((g) => props.selectedIds.includes(g.id)).length
)

function isGroupSelected(group: Group): boolean {
  if (group.is_exclusive || props.restrictPublicGroups) {
    return props.selectedIds.includes(group.id)
  }
  return true
}

function setSelected(groupId: number, selected: boolean): void {
  const next = new Set(props.selectedIds)
  if (selected) next.add(groupId)
  else next.delete(groupId)
  emit('update:selectedIds', [...next])
}

function toggleExclusiveGroup(groupId: number): void {
  const group = props.groups.find((g) => g.id === groupId)
  if (group?.is_exclusive) setSelected(groupId, !isGroupSelected(group))
}

function togglePublicGroup(groupId: number): void {
  const group = props.groups.find((g) => g.id === groupId)
  if (group && !group.is_exclusive) setSelected(groupId, !isGroupSelected(group))
}

// 关闭限制时把公开分组全部勾回，避免保存出一份"限制已关但只勾了两个"的误导状态。
// 专属分组的勾选与限制开关无关，保持原状。
function toggleRestrictPublicGroups(): void {
  const next = !props.restrictPublicGroups
  emit('update:restrictPublicGroups', next)
  if (!next) {
    const kept = new Set(props.selectedIds)
    for (const group of props.groups) {
      if (!group.is_exclusive) kept.add(group.id)
    }
    emit('update:selectedIds', [...kept])
  }
}

function groupRateValue(groupId: number): number | null {
  return props.groupRates[groupId] ?? null
}

function updateGroupRate(groupId: number, value: string): void {
  const parsed = value === '' ? null : parseFloat(value)
  const next = { ...props.groupRates, [groupId]: parsed !== null && !isNaN(parsed) ? parsed : null }
  emit('update:groupRates', next)
}
</script>

<style scoped>
/* 隐藏数字输入框的箭头按钮 */
.hide-spinner::-webkit-outer-spin-button,
.hide-spinner::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.hide-spinner {
  -moz-appearance: textfield;
}
</style>
