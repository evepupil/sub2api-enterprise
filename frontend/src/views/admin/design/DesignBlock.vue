<template>
  <section class="card p-4">
    <div class="mb-3">
      <h3 class="text-sm font-semibold text-content-strong">{{ heading }}</h3>
      <p v-if="hint" class="mt-0.5 text-xs text-content-muted">{{ hint }}</p>
    </div>
    <slot />
  </section>
</template>

<script setup lang="ts">
// 示范页的分块外壳，只在设计规范页里用。
defineProps<{
  heading: string
  hint?: string
}>()
</script>
