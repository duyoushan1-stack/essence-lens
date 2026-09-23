<script setup lang="ts">
defineProps<{
  message: string | null
  retryable: boolean
}>()

const emit = defineEmits<{
  retry: []
  dismiss: []
}>()
</script>

<template>
  <div
    v-if="message"
    class="fixed inset-x-4 top-20 z-50 mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl border border-[#dca99a]/60 bg-[#fffaf7] px-4 py-3 text-sm text-danger shadow-lg md:inset-x-6 md:top-24"
    role="alert"
  >
    <p class="min-w-0 flex-1">{{ message }}</p>
    <div class="flex shrink-0 items-center gap-2">
      <button
        v-if="retryable"
        type="button"
        class="rounded-full px-3 py-1 font-medium hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        @click="emit('retry')"
      >
        重新讀取
      </button>
      <button
        type="button"
        class="flex items-center rounded-full p-1 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        aria-label="關閉通知"
        @click="emit('dismiss')"
      >
        <Icon name="line-md:close" size="18" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
