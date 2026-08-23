<script setup lang="ts">
import type { Proposal, ProposalStatus } from '~~/shared/types/proposal'

defineProps<{
  status: ProposalStatus
  proposal: Proposal | null
  error: string | null
}>()
</script>

<template>
  <section
    class="min-h-80 rounded-[2rem] border border-[#D8DED8] bg-white/80 p-7 shadow-[0_20px_60px_rgba(32,38,34,0.06)] sm:p-10"
    aria-live="polite"
    aria-atomic="true"
  >
    <div v-if="status === 'idle'" class="flex min-h-64 items-center">
      <p class="text-lg leading-8 text-[#68726B]">
        尚未產生提案。<br >
        讓我們替你安排一個輕鬆的午後。
      </p>
    </div>

    <div v-else-if="status === 'loading'" class="flex min-h-64 items-center">
      <p class="text-lg leading-8 text-[#68726B]">正在產生提案，請稍候。</p>
    </div>

    <div
      v-else-if="status === 'success' && proposal"
      class="flex min-h-64 flex-col justify-center gap-5"
    >
      <p class="text-sm font-medium uppercase tracking-[0.2em] text-[#F1BF82]">Your proposal</p>
      <h2 class="text-3xl font-medium leading-tight tracking-[-0.03em] text-[#202622] sm:text-4xl">
        {{ proposal.title }}
      </h2>
      <p class="max-w-lg text-base leading-8 text-[#68726B] sm:text-lg">
        {{ proposal.description }}
      </p>
    </div>

    <div v-else class="flex min-h-64 items-center">
      <p class="text-lg leading-8 text-[#9B4D37]">
        {{ error || '目前無法產生提案，請稍後再試。' }}
      </p>
    </div>
  </section>
</template>
