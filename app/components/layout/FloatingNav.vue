<script setup lang="ts">
const savedProposals = useSavedProposalsStore()
</script>

<template>
  <nav
    class="fixed inset-x-6 top-6 z-40 hidden items-center gap-1 text-sm text-ink md:flex"
    aria-label="主要導覽"
  >
    <NuxtLink
      to="/"
      class="cursor-pointer rounded-full px-4 py-2.5 font-medium tracking-[0.18em] transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      aria-label="Essence Lens 首頁"
    >
      Essence Lens
    </NuxtLink>
    <NuxtLink
      to="/"
      class="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-2.5 transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      active-class="font-semibold"
    >
      <Icon name="fluent:home-24-regular" size="18" aria-hidden="true" />
      首頁
    </NuxtLink>
    <NuxtLink
      to="/saved-proposals"
      class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3 py-2.5 transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      active-class="font-semibold"
    >
      <Icon name="fluent:mail-inbox-24-regular" size="19" aria-hidden="true" />
      <span>收件匣</span>
      <span
        v-if="savedProposals.initialized && savedProposals.count"
        class="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold leading-5 text-ink"
        :aria-label="`${savedProposals.count} 個收藏`"
      >
        {{ savedProposals.count > 99 ? '99+' : savedProposals.count }}
      </span>
    </NuxtLink>
  </nav>
  <div class="fixed left-5 top-5 z-40 md:hidden">
    <NuxtLink
      to="/"
      class="cursor-pointer text-sm font-medium tracking-[0.2em] text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
      aria-label="Essence Lens 首頁"
    >
      Essence Lens
    </NuxtLink>
  </div>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around rounded-[1.35rem] border border-white/75 bg-white/62 p-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))] text-sm text-ink shadow-[0_0.75rem_2rem_rgba(44,85,82,0.08)] backdrop-blur-md md:hidden"
    aria-label="主要導覽"
  >
    <NuxtLink
      to="/"
      class="inline-flex min-w-24 cursor-pointer flex-col items-center gap-1 rounded-xl px-4 py-2 text-xs text-muted transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      active-class="font-semibold text-ink"
    >
      <Icon name="fluent:home-24-regular" size="21" aria-hidden="true" />
      <span>首頁</span>
    </NuxtLink>
    <NuxtLink
      to="/saved-proposals"
      class="relative inline-flex min-w-24 cursor-pointer flex-col items-center gap-1 rounded-xl px-4 py-2 text-xs text-muted transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      active-class="font-semibold text-ink"
    >
      <Icon name="fluent:mail-inbox-24-regular" size="21" aria-hidden="true" />
      <span>收件匣</span>
      <span
        v-if="savedProposals.initialized && savedProposals.count"
        class="absolute right-3 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold leading-4 text-ink"
        :aria-label="`${savedProposals.count} 個收藏`"
      >
        {{ savedProposals.count > 99 ? '99+' : savedProposals.count }}
      </span>
    </NuxtLink>
  </nav>
</template>
