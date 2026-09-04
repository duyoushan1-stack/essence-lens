<script setup lang="ts">
const props = defineProps<{
  loading: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  generate: []
}>()
</script>

<template>
  <button
    type="button"
    class="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition-transform hover:-translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    :disabled="props.disabled || loading"
    :aria-busy="loading"
    @click="emit('generate')"
  >
    {{ loading ? '生成中…' : '生成提案' }}
  </button>
</template>
