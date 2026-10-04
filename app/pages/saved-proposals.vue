<script setup lang="ts">
const savedProposals = useSavedProposalsStore()
const selectedRecordId = ref<string | null>(null)
const dialogTrigger = ref<HTMLButtonElement | null>(null)
const inboxHeading = ref<HTMLHeadingElement | null>(null)
const {
  searchInput,
  selectedCategory,
  selectedSort,
  categoryOptions,
  filteredRecords,
  selectedCategoryLabel,
  selectCategory,
  selectSort,
  clearFilters
} = useSavedProposalFilters()

const selectedRecord = computed(
  () =>
    savedProposals.records.find((record) => record.proposal.id === selectedRecordId.value) ?? null
)

const openRecord = (proposalId: string, trigger: HTMLButtonElement) => {
  selectedRecordId.value = proposalId
  dialogTrigger.value = trigger
}

const closeRecord = async () => {
  selectedRecordId.value = null
  await nextTick()
  if (dialogTrigger.value?.isConnected) dialogTrigger.value.focus()
}

const removeRecord = async (proposalId: string) => {
  const removed = await savedProposals.remove(proposalId)
  if (!removed) return
  if (selectedRecordId.value === proposalId) {
    selectedRecordId.value = null
    await nextTick()
    inboxHeading.value?.focus()
  }
}
</script>

<template>
  <main
    class="min-h-[100dvh] px-4 pb-32 pt-24 text-ink sm:px-8 sm:pb-32 sm:pt-24 md:pb-16 md:pt-28 lg:pl-12 lg:pr-12"
  >
    <div class="mx-auto max-w-7xl">
      <header class="max-w-2xl">
        <h1
          ref="inboxHeading"
          tabindex="-1"
          class="text-4xl font-semibold tracking-[-0.055em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink sm:text-5xl"
        >
          收件匣
        </h1>
        <p class="mt-4 max-w-xl text-base leading-7 text-muted">
          收藏屬於你的靈感提案，隨時回來找回適合自己的週末節奏。
        </p>
      </header>

      <section class="mt-10 space-y-4" aria-label="收藏篩選">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="提案分類">
            <button
              v-for="category in categoryOptions"
              :key="category.id"
              type="button"
              class="min-h-10 shrink-0 cursor-pointer rounded-full border px-4 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              :class="
                selectedCategory === category.id
                  ? 'border-accent bg-accent text-ink'
                  : 'border-white/80 bg-white/72 text-muted hover:bg-white'
              "
              :aria-pressed="selectedCategory === category.id"
              @click="selectCategory(category.id)"
            >
              {{ category.label }}
            </button>
          </div>
          <div class="flex w-full min-w-0 items-center gap-2 lg:w-auto lg:shrink-0">
            <label class="relative min-w-0 flex-1 lg:w-72 lg:flex-none xl:w-80">
              <span class="sr-only">搜尋收藏的提案</span>
              <Icon
                name="codicon:search"
                size="18"
                class="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <!-- prettier-ignore -->
              <input
                v-model="searchInput"
                type="search"
                placeholder="搜尋收藏的提案…"
                class="min-h-12 w-full rounded-full border border-white/85 bg-white/72 pl-11 pr-11 text-sm text-ink outline-none backdrop-blur-sm placeholder:text-muted/75 focus:border-[#9bb5a6] focus:ring-2 focus:ring-[#9bb5a6]/35"
              >
              <button
                v-if="searchInput"
                type="button"
                class="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                aria-label="清除搜尋"
                @click="searchInput = ''"
              >
                <Icon name="line-md:close" size="17" aria-hidden="true" />
              </button>
            </label>
            <label class="relative shrink-0">
              <span class="sr-only">排序收藏</span>
              <select
                :value="selectedSort"
                class="min-h-12 w-full cursor-pointer appearance-none rounded-full border border-white/85 bg-white/72 px-5 pr-10 text-sm text-ink outline-none backdrop-blur-sm focus:border-[#9bb5a6] focus:ring-2 focus:ring-[#9bb5a6]/35 sm:w-40"
                @change="selectSort"
              >
                <option value="newest">最新收藏</option>
                <option value="oldest">最早收藏</option>
              </select>
              <Icon
                name="line-md:chevron-down"
                size="17"
                class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
            </label>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 text-sm text-muted">
          <span>{{ selectedCategoryLabel }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ filteredRecords.length }} 個收藏</span>
        </div>
      </section>

      <section class="mt-8" aria-live="polite" :aria-busy="savedProposals.status === 'loading'">
        <div
          v-if="savedProposals.status === 'loading'"
          class="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <div
            v-for="index in 4"
            :key="index"
            class="aspect-[1.15/1] animate-pulse rounded-2xl bg-white/55"
          />
        </div>
        <div
          v-else-if="savedProposals.status === 'error'"
          class="rounded-2xl border border-[#dca99a]/60 bg-white/70 p-8 text-center"
        >
          <p class="text-danger">{{ savedProposals.error }}</p>
          <button
            type="button"
            class="mt-4 cursor-pointer rounded-full bg-accent px-5 py-3 text-sm font-semibold"
            @click="savedProposals.load"
          >
            重新讀取
          </button>
        </div>
        <div
          v-else-if="!savedProposals.records.length"
          class="rounded-2xl border border-white/80 bg-white/60 px-6 py-16 text-center shadow-sm"
        >
          <Icon
            name="fluent:mail-inbox-28-filled"
            size="34"
            class="text-[#7b9f98]"
            aria-hidden="true"
          />
          <h2 class="mt-4 text-xl font-semibold">還沒有收藏提案</h2>
          <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            在提案卡上點擊愛心，讓喜歡的靈感留在收件匣裡。
          </p>
          <NuxtLink
            to="/"
            class="mt-6 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-ink"
            >探索提案</NuxtLink
          >
        </div>
        <div
          v-else-if="!filteredRecords.length"
          class="rounded-2xl border border-white/80 bg-white/60 px-6 py-16 text-center shadow-sm"
        >
          <Icon name="codicon:search" size="32" class="text-[#7b9f98]" aria-hidden="true" />
          <h2 class="mt-4 text-xl font-semibold">找不到符合的提案</h2>
          <p class="mt-2 text-sm text-muted">換個關鍵字或清除篩選條件試試。</p>
          <button
            type="button"
            class="mt-6 cursor-pointer rounded-full bg-accent px-5 py-3 text-sm font-semibold text-ink"
            @click="clearFilters"
          >
            清除篩選
          </button>
        </div>
        <div v-else class="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <SavedProposalCard
            v-for="record in filteredRecords"
            :key="record.proposal.id"
            :record="record"
            @open="openRecord(record.proposal.id, $event)"
            @remove="removeRecord(record.proposal.id)"
          />
        </div>
      </section>
    </div>

    <SavedProposalDetailDialog
      :record="selectedRecord"
      :open="Boolean(selectedRecord)"
      @close="closeRecord"
      @remove="selectedRecord && removeRecord(selectedRecord.proposal.id)"
    />
  </main>
</template>
