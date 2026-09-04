<script setup lang="ts">
const props = defineProps<{
  status: ImageUploadStatus
  file: File | null
  previewUrl: string | null
  dimensions: ImageDimensions | null
  errorCode: ImageUploadErrorCode | null
  loading: boolean
  canGenerate?: boolean
  generating?: boolean
}>()

const emit = defineEmits<{
  select: [file: File]
  generate: []
  remove: []
}>()

const fileInput = ref<HTMLInputElement | null>(null)

const errorMessages = {
  'empty-file': '這個檔案沒有內容，請重新選取圖片。',
  'unsupported-type': '請選擇 JPG、PNG 或 WebP 圖片。',
  'file-too-large': '圖片需要小於 4 MB，請選擇較小的檔案。',
  'invalid-image': '這個檔案無法讀取成圖片，請重新選取。',
  'image-dimensions-invalid': '圖片尺寸需介於 50×50 與 7200×7200 像素。'
}

const errorMessage = computed(() => {
  if (!props.errorCode) {
    return null
  }

  return errorMessages[props.errorCode]
})

const openFilePicker = () => {
  if (!props.loading) {
    fileInput.value?.click()
  }
}

const handleFileChange = (event: Event) => {
  const input = event.target

  if (!(input instanceof HTMLInputElement)) {
    return
  }

  const nextFile = input.files?.[0]
  input.value = ''

  if (nextFile) {
    emit('select', nextFile)
  }
}
</script>

<template>
  <section
    class="rounded-[2rem] border border-border bg-surface/85 p-4 shadow-sm sm:p-6"
    aria-labelledby="image-upload-title"
    :aria-busy="loading"
  >
    <div class="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 id="image-upload-title" class="text-lg font-medium tracking-[-0.02em] text-ink">
          選一張靈感圖片
        </h2>
        <p id="image-upload-help" class="mt-1 text-sm leading-6 text-muted">
          檔案大小上限 4 MB，支援 JPG、PNG 或 WebP
        </p>
      </div>
      <span v-if="status === 'ready'" class="shrink-0 text-sm text-muted">已準備好</span>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="sr-only"
      aria-describedby="image-upload-help"
      @change="handleFileChange"
    >

    <div v-if="status === 'ready' && previewUrl && file" class="md:aspect-[4/3] min-h-72">
      <ImageUploadPreview
        :preview-url="previewUrl"
        :file-name="file.name"
        :dimensions="dimensions"
        :disabled="loading"
        :can-generate="canGenerate"
        :generating="generating"
        @replace="openFilePicker"
        @generate="emit('generate')"
        @remove="emit('remove')"
      />
    </div>

    <div
      v-else
      class="flex min-h-72 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-page px-6 py-10 text-center"
    >
      <p v-if="status === 'validating'" class="text-sm leading-6 text-muted" aria-live="polite">
        正在檢查圖片，請稍候。
      </p>
      <template v-else>
        <Icon
          name="line-md:file-upload"
          mode="svg"
          size="48"
          class="text-accent"
          aria-hidden="true"
        />
        <p class="mt-5 max-w-xs text-sm leading-6 text-muted">
          {{ status === 'error' ? '目前沒有可用的圖片' : '從你的裝置選取一張圖片' }}
        </p>
        <button
          type="button"
          class="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold tracking-wider text-white transition-transform hover:-translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="openFilePicker"
        >
          選取圖片
        </button>
      </template>
    </div>

    <p v-if="errorMessage" class="mt-4 text-sm leading-6 text-danger" role="alert">
      {{ errorMessage }}
    </p>
  </section>
</template>
