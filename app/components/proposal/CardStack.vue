<script setup lang="ts">
const props = defineProps<{
  proposals: ReadonlyArray<Proposal>
  fallbackImageUrl?: string | null
}>()

const { activeIndex, visibleProposals, getCardOffset, selectCard, nextCard } = useProposalCardStack(
  toRef(props, 'proposals')
)
</script>

<template>
  <section
    v-if="visibleProposals.length"
    class="grid justify-items-center gap-4"
    data-proposal-card-stack
    aria-label="提案選擇"
  >
    <div class="relative isolate mx-auto min-h-[35rem] w-full max-w-[28rem]">
      <ProposalCardMotion
        v-for="(proposal, index) in visibleProposals"
        :key="`${proposal.id}-${index}`"
        :offset="getCardOffset(index)"
        :active="getCardOffset(index) === 0"
        @next="nextCard"
      >
        <ProposalCard
          :proposal="proposal"
          :index="index"
          :fallback-image-url="props.fallbackImageUrl"
        />
      </ProposalCardMotion>
    </div>

    <nav class="flex items-center justify-center gap-2" aria-label="提案分頁">
      <button
        v-for="(proposal, index) in visibleProposals"
        :key="`${proposal.id}-${index}-pagination`"
        type="button"
        class="h-2 cursor-pointer rounded-full transition-[width,background-color] duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-default"
        :class="index === activeIndex ? 'w-8 bg-ink' : 'w-2 bg-ink/25 hover:bg-ink/45'"
        :aria-label="`前往第 ${index + 1} 張提案`"
        :aria-current="index === activeIndex ? 'page' : undefined"
        :disabled="visibleProposals.length < 2"
        @click="selectCard(index)"
      />
    </nav>
  </section>
</template>
