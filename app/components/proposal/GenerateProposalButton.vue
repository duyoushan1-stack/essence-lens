<script setup lang="ts">
defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  generate: []
}>()
</script>

<template>
  <button
    type="button"
    class="cursor-pointer inline-flex min-h-12 items-center justify-center rounded-full bg-[#F1BF82] px-7 text-sm font-semibold text-white transition-colors hover:bg-[#D9673F] active:bg-[#C95B37] disabled:cursor-not-allowed disabled:opacity-60"
    :disabled="loading"
    :aria-busy="loading"
    @click="emit('generate')"
  >
    {{ loading ? '產生中…' : '產生提案' }}
  </button>
</template>
