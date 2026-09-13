<template>
  <article
    class="relative mx-auto flex min-h-[35rem] w-full max-w-[28rem] flex-col overflow-visible rounded-[2rem] border border-border bg-surface/85 p-6 text-ink shadow-sm sm:p-4"
    data-proposal-skeleton
    aria-hidden="true"
  >
    <div
      class="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem] bg-gradient-to-b from-white/25 via-transparent to-page/10"
    />

    <div class="relative flex min-h-full flex-col">
      <div
        class="proposal-skeleton-shimmer aspect-[16/9] w-full flex-none rounded-[1.5rem]"
        data-proposal-skeleton-media
      />

      <div class="mt-auto pt-7">
        <div class="proposal-skeleton-shimmer h-9 w-3/4 rounded-full" />

        <div class="mt-4 space-y-2">
          <div class="proposal-skeleton-shimmer h-4 w-full rounded-full" />
          <div class="proposal-skeleton-shimmer h-4 w-5/6 rounded-full" />
        </div>

        <div class="mt-7 space-y-3">
          <div v-for="row in 3" :key="row" class="flex items-center gap-4 border-b border-border/70 pb-3">
            <span class="proposal-skeleton-shimmer h-4 w-14 shrink-0 rounded-full" />
            <span class="proposal-skeleton-shimmer h-4 flex-1 rounded-full" />
          </div>
        </div>

        <div class="mt-6 flex items-center gap-4 rounded-full border border-border px-4 py-3">
          <span class="proposal-skeleton-shimmer h-4 flex-1 rounded-full" />
          <span class="proposal-skeleton-shimmer h-5 w-5 shrink-0 rounded-full" />
        </div>
      </div>
    </div>
  </article>
</template>
