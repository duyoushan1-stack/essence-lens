<script setup lang="ts">
import type { Proposal } from '../../../shared/types/proposal'

const props = defineProps<{
  proposal: Proposal
  fallbackImageUrl?: string | null
}>()

const savedProposals = useSavedProposalsStore()
const saved = computed(() => savedProposals.isSaved(props.proposal.id))
const pending = computed(() => savedProposals.isPending(props.proposal.id))

const toggleSaved = async () => {
  if (pending.value) return

  if (!savedProposals.initialized) {
    await savedProposals.load()
    if (!savedProposals.initialized) return
  }

  if (pending.value) return

  if (saved.value) {
    await savedProposals.remove(props.proposal.id)
    return
  }

  await savedProposals.save(props.proposal, props.fallbackImageUrl)
}
</script>

<template>
  <button
    type="button"
    class="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-white/70 bg-white/80 text-[#d89432] shadow-sm backdrop-blur-md transition duration-200 hover:-translate-y-px hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white active:scale-95 disabled:cursor-wait disabled:opacity-60"
    :aria-label="saved ? '取消收藏提案' : '收藏提案'"
    :aria-pressed="saved"
    :disabled="pending"
    @click.stop="toggleSaved"
    @pointerdown.stop
  >
    <Icon :name="saved ? 'line-md:heart-filled' : 'line-md:heart'" size="19" aria-hidden="true" />
  </button>
</template>
