interface FetchResponseError {
  response?: {
    status?: number
    _data?: unknown
  }
}

const isFetchResponseError = (error: unknown): error is FetchResponseError =>
  typeof error === 'object' && error !== null && 'response' in error

const isRejectedResponse = (value: unknown): value is ProposalApiRejectedResponse => {
  if (typeof value !== 'object' || value === null || !('status' in value)) {
    return false
  }

  return value.status === 'rejected' && 'reasons' in value && Array.isArray(value.reasons)
}

const getRejectedResponse = (error: unknown): ProposalApiRejectedResponse | null => {
  if (!isFetchResponseError(error)) {
    return null
  }

  return isRejectedResponse(error.response?._data) ? error.response._data : null
}

const createIdempotencyKey = () => crypto.randomUUID()

export function useProposal() {
  const proposals = ref<Proposal[]>([])
  const status = ref<ProposalStatus>('idle')
  const error = ref<string | null>(null)
  const rejectionReasons = ref<ProposalApiRejectedResponse['reasons']>([])

  const loading = computed(() => status.value === 'pending')

  const generate = async (file: File) => {
    if (loading.value) {
      return
    }

    status.value = 'pending'
    error.value = null
    rejectionReasons.value = []
    proposals.value = []

    const body = new FormData()
    body.append('file', file)
    body.append('idempotencyKey', createIdempotencyKey())

    try {
      const response = await $fetch<ProposalApiResponse>('/api/proposal', {
        method: 'POST',
        body
      })

      if (response.status === 'success') {
        proposals.value = response.proposals
        status.value = 'success'
        return
      }

      if (response.status === 'rejected') {
        rejectionReasons.value = response.reasons
        status.value = 'rejected'
        return
      }

      status.value = 'error'
      error.value = '目前無法產生提案，請稍後再試。'
    } catch (requestError: unknown) {
      const rejectedResponse = getRejectedResponse(requestError)

      if (rejectedResponse) {
        rejectionReasons.value = rejectedResponse.reasons
        status.value = 'rejected'
        return
      }

      status.value = 'error'
      error.value = '目前無法產生提案，請稍後再試。'
    }
  }

  const retry = async (file: File) => {
    if (status.value !== 'error' || loading.value) {
      return
    }

    await generate(file)
  }

  const reset = () => {
    proposals.value = []
    status.value = 'idle'
    error.value = null
    rejectionReasons.value = []
  }

  return {
    proposals: readonly(proposals),
    status: readonly(status),
    loading: readonly(loading),
    error: readonly(error),
    rejectionReasons: readonly(rejectionReasons),
    generate,
    retry,
    reset
  }
}
