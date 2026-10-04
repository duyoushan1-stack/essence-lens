<script setup lang="ts">
import type { SavedProposalRecord } from '../../../shared/schemas/saved-proposal'
import { getProposalCategoryLabel } from '../../constants/proposal-categories'

const props = defineProps<{
  record: SavedProposalRecord
}>()

const emit = defineEmits<{
  open: [trigger: HTMLButtonElement]
  remove: []
}>()

const { coverUrl } = useSavedProposalCover(toRef(props, 'record'))
const categoryLabel = computed(() => getProposalCategoryLabel(props.record.proposal.perspective))
const savedDate = computed(() =>
  new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(props.record.savedAt)
  )
)

const openDetails = (event: MouseEvent) => {
  if (event.currentTarget instanceof HTMLButtonElement) {
    emit('open', event.currentTarget)
  }
}
</script>

<template>
  <article
    class="group overflow-hidden rounded-2xl border border-white/80 bg-white/78 shadow-[0_1rem_2.5rem_rgba(44,85,82,0.08)] backdrop-blur-sm max-md:flex max-md:items-stretch"
  >
    <div
      class="relative aspect-[1.65/1] overflow-hidden bg-[#dce8e2] max-md:aspect-auto max-md:w-30 max-md:shrink-0"
    >
      <button
        v-if="coverUrl"
        type="button"
        class="block h-full w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ink"
        :aria-label="`閱讀收藏：${record.proposal.title}`"
        @click="openDetails"
      >
        <!-- prettier-ignore -->
        <img
          :src="coverUrl"
          alt=""
          class="h-full w-full object-cover saturate-[0.85] transition duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          decoding="async"
        >
      </button>
      <button
        v-else
        type="button"
        class="flex h-full w-full cursor-pointer items-center justify-center px-6 text-center text-sm text-muted focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ink"
        :aria-label="`閱讀收藏：${record.proposal.title}`"
        @click="openDetails"
      >
        封面暫時無法顯示
      </button>
    </div>
    <div class="min-w-0 flex-1">
      <div class="space-y-3 p-4 sm:p-5 max-md:p-3">
        <h2 class="line-clamp-2 text-lg font-semibold leading-snug tracking-[-0.03em] text-ink">
          <button
            type="button"
            class="w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            :aria-label="`閱讀收藏：${record.proposal.title}`"
            @click="openDetails"
          >
            {{ record.proposal.title }}
          </button>
        </h2>
        <p class="line-clamp-2 text-sm leading-6 text-muted max-md:hidden">
          {{ record.proposal.summary }}
        </p>
        <p v-if="record.proposal.location?.name" class="truncate text-xs text-muted">
          {{ record.proposal.location.name }}
        </p>
        <div class="flex items-center justify-between gap-3 text-xs text-muted">
          <span class="rounded-full bg-[#edf5f0] px-3 py-1 text-[#3d6b60]">{{
            categoryLabel
          }}</span>
          <time :datetime="record.savedAt">{{ savedDate }}</time>
        </div>
      </div>
      <div
        class="flex justify-end border-t border-ink/8 px-4 py-2 max-md:border-0 max-md:px-2 max-md:py-0"
      >
        <button
          type="button"
          class="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm text-muted transition hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          @click="emit('remove')"
        >
          <Icon name="line-md:heart-filled" size="17" aria-hidden="true" />
          取消收藏
        </button>
      </div>
    </div>
  </article>
</template>
