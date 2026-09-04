export function useImageUpload() {
  const file = ref<File | null>(null)
  const previewUrl = ref<string | null>(null)
  const dimensions = ref<ImageDimensions | null>(null)
  const status = ref<ImageUploadStatus>('idle')
  const errorCode = ref<ImageUploadErrorCode | null>(null)
  const loading = computed(() => status.value === 'validating')

  const revokePreview = () => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
    }

    previewUrl.value = null
  }

  const selectFile = async (nextFile: File) => {
    status.value = 'validating'
    errorCode.value = null

    const result = await validateImageFile(nextFile)

    if (!result.valid) {
      status.value = file.value ? 'ready' : 'error'
      errorCode.value = result.code
      return
    }

    const previousPreviewUrl = previewUrl.value
    file.value = nextFile
    previewUrl.value = result.previewUrl
    dimensions.value = result.dimensions
    status.value = 'ready'
    errorCode.value = null

    if (previousPreviewUrl) {
      URL.revokeObjectURL(previousPreviewUrl)
    }
  }

  const removeFile = () => {
    revokePreview()
    file.value = null
    dimensions.value = null
    errorCode.value = null
    status.value = 'idle'
  }

  onUnmounted(revokePreview)

  return {
    file: readonly(file),
    previewUrl: readonly(previewUrl),
    dimensions: readonly(dimensions),
    status: readonly(status),
    errorCode: readonly(errorCode),
    loading: readonly(loading),
    selectFile,
    removeFile
  }
}
