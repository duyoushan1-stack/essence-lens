<script setup lang="ts">
const {
  file,
  previewUrl,
  dimensions,
  status: uploadStatus,
  errorCode,
  selectFile: selectImageFile,
  removeFile: removeImageFile
} = useImageUpload()
const {
  proposals,
  status: proposalStatus,
  error: proposalError,
  rejectionReasons,
  generate,
  retry,
  reset
} = useProposal()

const flowStatus = computed(() =>
  getProposalFlowStatus({
    uploadStatus: uploadStatus.value,
    uploadErrorCode: errorCode.value,
    proposalStatus: proposalStatus.value
  })
)

const loading = computed(() => flowStatus.value === 'validating' || flowStatus.value === 'pending')

const selectFile = async (nextFile: File) => {
  reset()
  await selectImageFile(nextFile)
}

const generateProposal = async () => {
  if (file.value) {
    await generate(file.value)
  }
}

const retryProposal = async () => {
  if (file.value) {
    await retry(file.value)
  }
}

const removeFile = async () => {
  reset()
  await nextTick()
  removeImageFile()
}
</script>

<template>
  <main
    class="flex min-h-[100dvh] items-center px-6 pb-32 pt-24 text-ink sm:px-10 sm:pb-32 sm:pt-24 md:px-10 md:pb-16 md:pt-16 lg:px-16 lg:py-20"
  >
    <ProposalFlowStage
      :status="flowStatus"
      :keep-initial-layout="uploadStatus === 'error' || Boolean(errorCode)"
    >
      <template #intro>
        <ProposalIntro />
      </template>

      <template #image>
        <ImageUploadPanel
          :status="uploadStatus"
          :file="file"
          :preview-url="previewUrl"
          :dimensions="dimensions"
          :error-code="errorCode"
          :loading="loading"
          :can-generate="flowStatus === 'ready'"
          :generating="flowStatus === 'pending'"
          @select="selectFile"
          @generate="generateProposal"
          @remove="removeFile"
        />
      </template>

      <template #status>
        <ProposalResultPanel
          :status="flowStatus"
          :proposals="proposals"
          :fallback-image-url="previewUrl"
          :error="proposalError"
          :rejection-reasons="rejectionReasons"
          @retry="retryProposal"
        />
      </template>
    </ProposalFlowStage>
  </main>
</template>
