<script setup lang="ts">
import type { SavedProposalRecord } from '../../../shared/schemas/saved-proposal'

const props = defineProps<{
  record: SavedProposalRecord | null
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  remove: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const recordRef = computed(() => props.record)
const { coverUrl } = useSavedProposalCover(recordRef)

watch(
  () => props.open,
  (open) => {
    if (!dialog.value) return
    if (open && !dialog.value.open) dialog.value.showModal()
    if (!open && dialog.value.open) dialog.value.close()
  },
  { flush: 'post' }
)

const close = () => emit('close')
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto max-h-[min(90dvh,48rem)] w-[min(92vw,42rem)] overflow-hidden rounded-[1.75rem] border border-white/80 bg-[#f9fbf8] p-0 text-ink shadow-[0_2rem_6rem_rgba(44,85,82,0.22)] backdrop:bg-ink/25"
    @cancel.prevent="close"
    @click.self="close"
  >
    <template v-if="record">
      <div
        class="detail-dialog__scroll max-h-[min(90dvh,48rem)] overflow-y-auto overscroll-contain"
      >
        <div class="relative aspect-[1.65/1] bg-[#dce8e2]">
          <!-- prettier-ignore -->
          <img
            v-if="coverUrl"
            :src="coverUrl"
            alt=""
            class="h-full w-full object-cover"
            decoding="async"
          >
          <div v-else class="flex h-full items-center justify-center text-sm text-muted">
            封面暫時無法顯示
          </div>
          <button
            type="button"
            class="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-white/85 text-ink backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label="關閉提案詳情"
            @click="close"
          >
            <Icon name="line-md:close" size="20" aria-hidden="true" />
          </button>
        </div>
        <div class="space-y-6 p-6 sm:p-8">
          <div>
            <p class="text-xs uppercase tracking-[0.18em] text-muted">收藏提案</p>
            <h2 class="mt-2 text-2xl font-semibold leading-tight tracking-[-0.04em]">
              {{ record.proposal.title }}
            </h2>
            <p class="mt-3 leading-7 text-muted">{{ record.proposal.summary }}</p>
          </div>
          <dl class="space-y-3 text-sm">
            <div
              v-for="(item, key) in record.proposal.itinerary"
              :key="key"
              class="border-t border-ink/10 pt-3"
            >
              <dt class="font-semibold text-ink">
                {{ key === 'morning' ? '早上' : key === 'noon' ? '中午' : '下午' }}
              </dt>
              <dd class="mt-1 text-muted">
                {{ item.title }}<span v-if="item.description">，{{ item.description }}</span>
              </dd>
            </div>
          </dl>
          <a
            v-if="record.proposal.location?.externalUrl"
            :href="record.proposal.location.externalUrl"
            target="_blank"
            rel="noreferrer"
            class="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#edf5f0] px-4 text-sm font-medium text-[#3d6b60] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="line-md:map-marker" size="19" aria-hidden="true" />
            {{ record.proposal.location.name }}
            <Icon name="line-md:arrow-right" size="18" aria-hidden="true" />
          </a>
          <div class="flex justify-end border-t border-ink/10 pt-4">
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-muted transition hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              @click="emit('remove')"
            >
              <Icon name="line-md:heart-filled" size="18" aria-hidden="true" />
              取消收藏
            </button>
          </div>
        </div>
      </div>
    </template>
  </dialog>
</template>

<style scoped>
.detail-dialog__scroll {
  scrollbar-gutter: stable;
  scrollbar-color: rgb(148 163 184 / 0.7) transparent;
  scrollbar-width: thin;
}

.detail-dialog__scroll::-webkit-scrollbar {
  width: 0.5rem;
}

.detail-dialog__scroll::-webkit-scrollbar-track {
  background: transparent;
}

.detail-dialog__scroll::-webkit-scrollbar-thumb {
  border: 0.125rem solid transparent;
  border-radius: 9999px;
  background-clip: content-box;
  background-color: rgb(148 163 184 / 0.7);
}

.detail-dialog__scroll::-webkit-scrollbar-thumb:hover {
  background-color: rgb(100 116 139 / 0.78);
}
</style>
