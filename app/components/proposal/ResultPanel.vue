<script setup lang="ts">
const props = defineProps<{
  status: ProposalFlowStatus
  proposals: ReadonlyArray<Proposal>
  error: string | null
  rejectionReasons: ReadonlyArray<ProposalRejectionReason>
}>()

const emit = defineEmits<{
  retry: []
}>()

const getReasonMessage = (reason: ProposalRejectionReason) => {
  if (reason.category === 'technical') {
    return '這個檔案目前無法使用，請重新選取圖片。'
  }

  if (reason.category === 'safety') {
    return '這張圖片不符合內容安全條件，請選擇其他圖片。'
  }

  if (reason.category === 'theme') {
    return '這張圖片的主題不適合產生目前的提案，請換一張圖片。'
  }

  return '這張圖片的視覺資訊不足，請選擇更清楚的場景圖片。'
}

const reasonMessages = computed(() => props.rejectionReasons.map(getReasonMessage))

const resultPanelClass = computed(() =>
  props.status === 'success'
    ? 'min-h-[30rem]'
    : 'min-h-80 rounded-[2rem] border border-border bg-surface/80 p-7 shadow-sm sm:p-10'
)
</script>

<template>
  <section
    :class="resultPanelClass"
    aria-live="polite"
    aria-atomic="true"
    :aria-busy="status === 'pending'"
  >
    <div v-if="status === 'idle' || status === 'ready'" class="flex min-h-64 items-center">
      <p class="text-lg leading-8 text-muted">
        {{ status === 'ready' ? '圖片已準備好，準備替你產生一個提案。' : '尚未產生提案。' }}
      </p>
    </div>

    <div v-else-if="status === 'pending'" class="flex min-h-64 items-center">
      <p class="text-lg leading-8 text-muted">正在分析圖片並產生提案，請稍候。</p>
    </div>

    <div v-else-if="status === 'rejected'" class="flex min-h-64 flex-col justify-center gap-5">
      <h2 class="text-xl font-medium text-ink">這張圖片目前不適合產生提案</h2>
      <ul v-if="reasonMessages.length" class="space-y-2 text-base leading-7 text-muted">
        <li v-for="message in reasonMessages" :key="message">{{ message }}</li>
      </ul>
      <p v-else class="text-base leading-7 text-muted">請更換一張圖片再試試。</p>
    </div>

    <div v-else-if="status === 'success'">
      <ProposalCardStack :proposals="proposals" />
    </div>

    <div v-else class="flex min-h-64 flex-col items-start justify-center gap-5">
      <p class="text-lg leading-8 text-danger">
        {{ error || '目前無法產生提案，請稍後再試。' }}
      </p>
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold tracking-wider text-ink transition-transform hover:-translate-y-px active:scale-[0.98]"
        @click="emit('retry')"
      >
        重新嘗試
      </button>
    </div>
  </section>
</template>
