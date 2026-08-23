<script setup lang="ts">
const { proposal, status, loading, error, generate } = useProposal()
</script>

<template>
  <main
    class="min-h-screen flex items-center px-6 py-10 text-[#202622] sm:px-10 sm:py-16 lg:px-16 lg:py-20"
  >
    <div
      class="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)] lg:gap-24"
    >
      <section class="space-y-10">
        <ProposalIntro />
        <ProposalGenerateProposalButton :loading="loading" @generate="generate" />
      </section>

      <ProposalResultPanel :status="status" :proposal="proposal" :error="error" />
    </div>
  </main>
</template>
