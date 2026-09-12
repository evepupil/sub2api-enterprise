<template>
  <button
    type="button"
    @click="toggle"
    class="relative inline-flex h-[22px] w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-500/60"
    :class="[modelValue ? 'bg-primary-600' : 'bg-line-strong']"
    role="switch"
    :aria-checked="modelValue"
  >
    <span
      class="pointer-events-none inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm ring-0 transition duration-150 ease-in-out"
      :class="[modelValue ? 'translate-x-[18px]' : 'translate-x-0']"
    />
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>
