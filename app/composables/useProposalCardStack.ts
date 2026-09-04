const MAX_VISIBLE_PROPOSALS = 3

export function useProposalCardStack(proposals: MaybeRefOrGetter<ReadonlyArray<Proposal>>) {
  const activeIndex = ref(0)
  const visibleProposals = computed(() => toValue(proposals).slice(0, MAX_VISIBLE_PROPOSALS))

  watch(visibleProposals, () => {
    activeIndex.value = 0
  })

  const getCardOffset = (index: number) => {
    if (!visibleProposals.value.length) {
      return 0
    }

    return (
      (index - activeIndex.value + visibleProposals.value.length) % visibleProposals.value.length
    )
  }

  const selectCard = (index: number) => {
    if (index >= 0 && index < visibleProposals.value.length) {
      activeIndex.value = index
    }
  }

  const nextCard = () => {
    if (visibleProposals.value.length > 1) {
      activeIndex.value = (activeIndex.value + 1) % visibleProposals.value.length
    }
  }

  return {
    activeIndex: readonly(activeIndex),
    visibleProposals,
    getCardOffset,
    selectCard,
    nextCard
  }
}
