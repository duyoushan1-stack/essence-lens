<script setup lang="ts">
const props = defineProps<{
  previewUrl: string
  fileName: string
  dimensions: ImageDimensions | null
  disabled?: boolean
  canGenerate?: boolean
  generating?: boolean
}>()

const emit = defineEmits<{
  replace: []
  generate: []
  remove: []
}>()

const previewFailed = ref(false)

watch(
  () => props.previewUrl,
  () => {
    previewFailed.value = false
  }
)

const formatDimensions = (dimensions: ImageDimensions | null) => {
  if (!dimensions) {
    return null
  }

  return `${dimensions.width} × ${dimensions.height}px`
}
</script>

<template>
  <div class="flex h-full flex-col gap-4">
    <div
      class="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[1.5rem] bg-page p-3"
    >
      <img
        v-if="!previewFailed"
        :src="previewUrl"
        :alt="`已選取的圖片：${fileName}`"
        class="max-h-full w-full object-contain"
        decoding="async"
        @error="previewFailed = true"
      >

      <div v-else class="flex max-w-xs flex-col items-center gap-4 text-center">
        <p class="text-sm leading-6 text-muted">圖片無法顯示，請重新選取。</p>
        <button
          type="button"
          class="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full border border-border px-4 text-sm font-medium text-ink transition-transform hover:-translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="disabled"
          @click="emit('replace')"
        >
          重新選取
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-ink">{{ fileName }}</p>
        <p v-if="formatDimensions(dimensions)" class="mt-1 text-xs text-muted">
          {{ formatDimensions(dimensions) }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="disabled"
          @click="emit('replace')"
        >
          更換圖片
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-full px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="disabled"
          @click="emit('remove')"
        >
          移除
        </button>
        <GenerateProposalButton
          :loading="props.generating ?? false"
          :disabled="!props.canGenerate"
          @generate="emit('generate')"
        />
      </div>
    </div>
  </div>
</template>
