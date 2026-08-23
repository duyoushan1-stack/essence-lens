import type { Proposal, ProposalStatus } from '~~/shared/types/proposal'

export function useProposal() {
  const proposal = ref<Proposal | null>(null)
  const status = ref<ProposalStatus>('idle')
  const error = ref<string | null>(null)

  const loading = computed(() => status.value === 'loading')

  const generate = async (): Promise<void> => {
    if (loading.value) {
      return
    }

    status.value = 'loading'
    error.value = null

    try {
      proposal.value = await $fetch<Proposal>('/api/proposal', {
        method: 'POST'
      })
      status.value = 'success'
    } catch {
      proposal.value = null
      status.value = 'error'
      error.value = '目前無法產生提案，請稍後再試。'
    }
  }

  return {
    proposal: readonly(proposal),
    status: readonly(status),
    loading: readonly(loading),
    error: readonly(error),
    generate
  }
}
