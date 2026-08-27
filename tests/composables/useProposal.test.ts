import { computed, readonly, ref } from 'vue'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Proposal } from '../../shared/types/proposal'

const fetchMock = vi.fn()
let useProposal: typeof import('../../app/composables/useProposal').useProposal

beforeAll(async () => {
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('readonly', readonly)
  vi.stubGlobal('$fetch', fetchMock)

  const proposalModule = await import('../../app/composables/useProposal')
  useProposal = proposalModule.useProposal
})

beforeEach(() => {
  fetchMock.mockReset()
})

describe('useProposal', () => {
  it('starts in the idle state without a proposal', () => {
    const state = useProposal()

    expect(state.status.value).toBe('idle')
    expect(state.loading.value).toBe(false)
    expect(state.proposal.value).toBeNull()
    expect(state.error.value).toBeNull()
  })

  it('tracks loading and success while requesting a proposal', async () => {
    const proposal: Proposal = {
      title: '午後散步與咖啡',
      description: '到附近街區散步，再找一間安靜的咖啡店休息。'
    }
    let resolveRequest: (value: Proposal) => void = () => undefined

    fetchMock.mockReturnValue(
      new Promise<Proposal>((resolve) => {
        resolveRequest = resolve
      })
    )

    const state = useProposal()
    const request = state.generate()

    expect(state.status.value).toBe('loading')
    expect(state.loading.value).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/proposal', { method: 'POST' })

    resolveRequest(proposal)
    await request

    expect(state.status.value).toBe('success')
    expect(state.loading.value).toBe(false)
    expect(state.proposal.value).toEqual(proposal)
    expect(state.error.value).toBeNull()
  })

  it('prevents duplicate requests while loading', async () => {
    let resolveRequest: (value: Proposal) => void = () => undefined

    fetchMock.mockReturnValue(
      new Promise<Proposal>((resolve) => {
        resolveRequest = resolve
      })
    )

    const state = useProposal()
    const firstRequest = state.generate()
    const secondRequest = state.generate()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveRequest({ title: '午後散步與咖啡', description: '測試提案' })
    await Promise.all([firstRequest, secondRequest])
  })

  it('tracks an error when the proposal request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Request failed'))

    const state = useProposal()
    await state.generate()

    expect(state.status.value).toBe('error')
    expect(state.loading.value).toBe(false)
    expect(state.proposal.value).toBeNull()
    expect(state.error.value).toBe('目前無法產生提案，請稍後再試。')
  })
})
