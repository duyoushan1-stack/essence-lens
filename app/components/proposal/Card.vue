<script setup lang="ts">
import type { Proposal } from '../../../shared/types/proposal'

const props = defineProps<{
  proposal: Proposal
  index: number
  fallbackImageUrl?: string | null
}>()

const isFavorite = ref(false)
const coverUrl = computed(() => props.proposal.cover.imageUrl ?? props.fallbackImageUrl ?? null)
const coverPosition = computed(() => ['center', '65% center', '35% center'][props.index % 3])

const itineraryItems = [
  { key: 'morning' as const, label: '早上', icon: 'line-md:sun-rising' },
  { key: 'noon' as const, label: '中午', icon: 'line-md:coffee' },
  { key: 'afternoon' as const, label: '下午', icon: 'line-md:moon-alt' }
]

type ItineraryKey = (typeof itineraryItems)[number]['key']

const expandedItineraryKey = ref<ItineraryKey | null>(null)

const isItineraryExpanded = (key: ItineraryKey) => expandedItineraryKey.value === key

const toggleItinerary = (key: ItineraryKey) => {
  expandedItineraryKey.value = isItineraryExpanded(key) ? null : key
}

const tone = computed(() => ['sage', 'blue', 'sand'][props.index % 3] ?? 'sage')
const dayToneClass = computed(() => {
  if (tone.value === 'blue') return 'text-[#4a789f]'
  if (tone.value === 'sand') return 'text-[#8d7453]'
  return 'text-[#4d7a67]'
})
const locationToneClass = computed(() => {
  if (tone.value === 'blue') return 'bg-[#eef5fb]/85 text-[#3e6b92]'
  if (tone.value === 'sand') return 'bg-[#f8f1e7]/85 text-[#806846]'
  return 'bg-[#edf5f0]/85 text-[#3d6b60]'
})
const hasLocation = computed(() => Boolean(props.proposal.location?.externalUrl))
</script>

<template>
  <article
    class="proposal-card group flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/75 bg-white/85 p-3 text-ink shadow-[0_1.2rem_3.25rem_rgba(44,85,82,0.12)]"
    :class="`proposal-card--${tone}`"
    :data-cover-source="proposal.cover.imageUrl ? 'generated' : 'upload-fallback'"
  >
    <div
      class="proposal-card-cover relative isolate aspect-[3/2] shrink-0 overflow-hidden rounded-[1.45rem] bg-gradient-to-br from-[#355849] to-[#10252d] text-white"
      :style="coverUrl ? { '--cover-image': `url(${coverUrl})` } : undefined"
      data-proposal-card-image
    >
      <img
        v-if="coverUrl"
        :src="coverUrl"
        alt=""
        class="proposal-card-cover__image absolute inset-0 z-0 h-full w-full object-cover saturate-[0.82] contrast-[0.97]"
        :style="{ objectPosition: coverPosition }"
        loading="lazy"
        decoding="async"
        aria-hidden="true"
      >
      <div v-if="coverUrl" class="proposal-card-cover__blur absolute inset-0 z-[1]" aria-hidden="true" />

      <div class="relative z-[4] flex items-center justify-between gap-3 px-3 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-white/90">
        <span class="inline-flex items-center gap-2">
          <span>PROPOSAL {{ String(index + 1).padStart(2, '0') }}</span>
        </span>
        <button
          type="button"
          class="inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/65 bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
          :aria-label="isFavorite ? '取消收藏提案' : '收藏提案'"
          :aria-pressed="isFavorite"
          @click.stop="isFavorite = !isFavorite"
        >
          <Icon
            :name="isFavorite ? 'line-md:heart-filled' : 'line-md:heart'"
            size="18"
            aria-hidden="true"
          />
        </button>
      </div>

      <div class="absolute inset-x-4 bottom-4 z-[4]">
        <h2 class="max-w-60 overflow-wrap-anywhere text-[clamp(1.15rem,1.8vw,1.55rem)] font-semibold leading-[1.08] tracking-[-0.045em] text-white">
          {{ proposal.title }}
        </h2>
        <p class="mt-2 line-clamp-2 max-w-70 text-sm leading-[1.5] text-white/85">
          {{ proposal.summary }}
        </p>
      </div>
    </div>

    <div class="flex h-full min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
      <ul class="m-0 flex min-h-0 flex-1 flex-col list-none overflow-y-auto p-0">
        <li
          v-for="item in itineraryItems"
          :key="item.key"
          class="flex flex-1 flex-col justify-center border-b border-[#437065]/20 px-0.5 py-1.5 text-base last:border-b-0"
          :class="dayToneClass"
        >
          <div class="grid min-h-9 grid-cols-[1.45rem_2.35rem_minmax(0,1fr)_2rem] items-center gap-1">
            <Icon :name="item.icon" size="20" aria-hidden="true" />
            <span class="font-semibold">{{ item.label }}</span>
            <strong class="min-w-0 text-sm font-medium leading-snug text-ink">
              {{ proposal.itinerary[item.key].title }}
            </strong>
            <button
              v-if="proposal.itinerary[item.key].description"
              :id="`proposal-${proposal.id}-${item.key}-toggle`"
              type="button"
              class="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-ink/65 transition-[background-color,color,transform] duration-200 hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-95"
              :aria-label="`${isItineraryExpanded(item.key) ? '收起' : '展開'}${item.label}行程詳情`"
              :aria-controls="`proposal-${proposal.id}-${item.key}-description`"
              :aria-expanded="isItineraryExpanded(item.key)"
              :data-itinerary-toggle="item.key"
              @click.stop="toggleItinerary(item.key)"
              @pointerdown.stop
            >
              <Icon
                :name="isItineraryExpanded(item.key) ? 'line-md:chevron-up' : 'line-md:chevron-down'"
                size="20"
                aria-hidden="true"
              />
            </button>
          </div>
          <div
            v-if="proposal.itinerary[item.key].description"
            :id="`proposal-${proposal.id}-${item.key}-description`"
            class="grid overflow-hidden transition-[grid-template-rows,margin] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
            :class="isItineraryExpanded(item.key) ? 'mt-1.5 grid-rows-[1fr]' : 'grid-rows-[0fr]'"
            :aria-hidden="!isItineraryExpanded(item.key)"
            :aria-labelledby="`proposal-${proposal.id}-${item.key}-toggle`"
          >
            <div class="min-h-0 overflow-hidden">
              <p class="mb-0 ml-[calc(1.45rem+2.35rem+0.5rem)] pr-8 text-sm leading-relaxed text-muted">
                {{ proposal.itinerary[item.key].description }}
              </p>
            </div>
          </div>
        </li>
      </ul>

      <a
        v-if="hasLocation && proposal.location"
        :href="proposal.location.externalUrl"
        target="_blank"
        rel="noreferrer"
        class="proposal-card-location mt-2 flex min-h-10 shrink-0 items-center justify-between gap-2 rounded-full border-0 px-4 py-2 text-[0.7rem] no-underline transition duration-200 ease-out hover:-translate-y-px hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        :class="locationToneClass"
        @click.stop
      >
        <span class="inline-flex min-w-0 items-center gap-2">
          <Icon name="line-md:map-marker" size="20" aria-hidden="true" />
          <span class="truncate font-medium">{{ proposal.location.name }}</span>
        </span>
        <Icon name="line-md:arrow-right" size="20" aria-hidden="true" />
      </a>
      <div
        v-else
        class="proposal-card-location mt-2 flex min-h-10 shrink-0 items-center justify-between gap-2 rounded-full border-0 bg-ink/5 px-4 py-2 text-base text-muted opacity-80"
      >
        <span class="inline-flex min-w-0 items-center gap-2">
          <Icon name="line-md:map-marker" size="20" aria-hidden="true" />
          <span class="truncate">尚未鎖定單一地點</span>
        </span>
      </div>
    </div>
  </article>
</template>
