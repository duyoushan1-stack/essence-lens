<script setup lang="ts">
const { file, previewUrl, dimensions, status, errorCode, loading, selectFile, removeFile } =
  useImageUpload()
</script>

<template>
  <main
    class="flex min-h-screen items-center px-6 py-10 text-ink sm:px-10 sm:py-16 lg:px-16 lg:py-20"
  >
    <div
      class="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)] lg:gap-24"
    >
      <section class="space-y-10">
        <ProposalIntro />
      </section>

      <ImageUploadPanel
        :status="status"
        :file="file"
        :preview-url="previewUrl"
        :dimensions="dimensions"
        :error-code="errorCode"
        :loading="loading"
        @select="selectFile"
        @remove="removeFile"
      />
    </div>
  </main>
</template>
