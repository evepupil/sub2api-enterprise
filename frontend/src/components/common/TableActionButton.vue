<template>
  <component
    :is="to ? RouterLink : 'button'"
    v-bind="to ? { to } : { type: 'button', disabled }"
    class="flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-gray-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :class="toneClasses[tone]"
    :title="title"
    @click="emit('click', $event)"
  >
    <Icon :name="icon" size="sm" />
    <span class="text-xs">{{ label }}</span>
  </component>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import Icon from '@/components/icons/Icon.vue'
import type { IconName } from '@/components/icons/Icon.vue'

// 表格/列表行内操作按钮：无边框、图标在上文字在下，悬停才浮出底色。
// tone 对应原版页面里已存在的悬停配色：default 常规操作、danger 删除类、
// success 启用/批准类、warning 停用类。
const toneClasses = {
  default: 'hover:bg-gray-100 hover:text-primary-600 dark:hover:bg-dark-700 dark:hover:text-primary-400',
  danger: 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400',
  success: 'hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400',
  warning: 'hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/20 dark:hover:text-orange-400'
} as const

withDefaults(
  defineProps<{
    icon: IconName
    label: string
    tone?: keyof typeof toneClasses
    disabled?: boolean
    title?: string
    /** 传入后渲染为 RouterLink（同款外观的链接按钮） */
    to?: RouteLocationRaw
  }>(),
  {
    tone: 'default',
    disabled: false
  }
)

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()
</script>
