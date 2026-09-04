<script setup lang="ts">
defineProps<{
  proposal: Proposal
  index: number
}>()
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      class="mb-auto h-60 w-full shrink-0 rounded-[1.5rem] bg-surface lg:h-80"
      data-proposal-card-image
      aria-hidden="true"
    />
    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-page/60">
      提案 {{ index + 1 }}
    </p>
    <h2
      class="mt-4 max-w-[16ch] text-[clamp(1.8rem,4vw,3.25rem)] leading-[1.05] tracking-[-0.04em]"
    >
      {{ proposal.title }}
    </h2>
    <p class="mt-5 max-w-[34rem] text-[1.05rem] leading-[1.8] text-page/70">
      {{ proposal.description }}
    </p>
  </div>
</template>
