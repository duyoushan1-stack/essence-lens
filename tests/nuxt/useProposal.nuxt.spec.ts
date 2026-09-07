import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ProposalApiRejectedResponse,
  ProposalApiSuccessResponse
} from '../../shared/types/proposal-api'

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn()
}))

mockNuxtImport('$fetch', () => fetchMock)

const file = new File(['image'], 'sample.jpg', { type: 'image/jpeg' })
const proposalResponse: ProposalApiSuccessResponse = {
  status: 'success',
  requestId: 'request-123',
  proposals: [
    {
      title: '午後散步與咖啡',
      description: '到附近街區散步，再找一間安靜的咖啡店休息。'
    }
  ]
}

interface RequestOptions {
  method: string
  body: FormData
  headers?: Record<string, string>
}

const getRequestOptions = (): RequestOptions => {
  const options = fetchMock.mock.calls.at(-1)?.[1]

  if (!options || typeof options !== 'object' || !('body' in options)) {
    throw new Error('Expected a request body')
  }

  return options as RequestOptions
}

const getIdempotencyKey = () => {
  const value = getRequestOptions().headers?.['Idempotency-Key']

  if (typeof value !== 'string') {
    throw new Error('Expected an idempotency key')
  }

  return value
}

beforeEach(() => {
  fetchMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useProposal', () => {
  it('starts in the idle state without a proposal', () => {
    const state = useProposal()

    expect(state.status.value).toBe('idle')
    expect(state.loading.value).toBe(false)
    expect(state.proposals.value).toEqual([])
    expect(state.error.value).toBeNull()
  })

  it('tracks pending and success while requesting a proposal', async () => {
    let resolveRequest: (value: ProposalApiSuccessResponse) => void = () => undefined

    fetchMock.mockReturnValue(
      new Promise<ProposalApiSuccessResponse>((resolve) => {
        resolveRequest = resolve
      })
    )

    const state = useProposal()
    const request = state.generate(file)

    expect(state.status.value).toBe('pending')
    expect(state.loading.value).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(getRequestOptions().method).toBe('POST')
    expect(getRequestOptions().body.get('file')).toBe(file)
    expect(getRequestOptions().body.get('idempotencyKey')).toBeNull()
    expect(getIdempotencyKey()).toEqual(expect.any(String))

    resolveRequest(proposalResponse)
    await request

    expect(state.status.value).toBe('success')
    expect(state.loading.value).toBe(false)
    expect(state.proposals.value).toEqual(proposalResponse.proposals)
    expect(state.error.value).toBeNull()
  })

  it('prevents duplicate requests while pending', async () => {
    let resolveRequest: (value: ProposalApiSuccessResponse) => void = () => undefined

    fetchMock.mockReturnValue(
      new Promise<ProposalApiSuccessResponse>((resolve) => {
        resolveRequest = resolve
      })
    )

    const state = useProposal()
    const firstRequest = state.generate(file)
    const secondRequest = state.generate(file)

    expect(fetchMock).toHaveBeenCalledOnce()

    resolveRequest(proposalResponse)
    await Promise.all([firstRequest, secondRequest])
  })

  it('maps a rejected API response to rejected state with reasons', async () => {
    const rejectedResponse: ProposalApiRejectedResponse = {
      status: 'rejected',
      requestId: 'request-456',
      reasons: [{ category: 'safety', code: 'sexual' }]
    }
    fetchMock.mockRejectedValueOnce({
      response: {
        status: 422,
        _data: { statusCode: 422, data: rejectedResponse }
      }
    })

    const state = useProposal()
    await state.generate(file)

    expect(state.status.value).toBe('rejected')
    expect(state.rejectionReasons.value).toEqual(rejectedResponse.reasons)
    expect(state.error.value).toBeNull()
  })

  it('preserves a normalized API error code without exposing provider details', async () => {
    fetchMock.mockRejectedValueOnce({
      response: {
        status: 503,
        _data: {
          statusCode: 503,
          data: {
            status: 'error',
            requestId: 'request-789',
            code: 'provider-unavailable'
          }
        }
      }
    })

    const state = useProposal()
    await state.generate(file)

    expect(state.status.value).toBe('error')
    expect(state.errorCode.value).toBe('provider-unavailable')
    expect(state.error.value).toBe('目前無法產生提案，請稍後再試。')
  })

  it('clears the error and uses a new key when retrying', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Request failed'))
      .mockResolvedValueOnce(proposalResponse)

    const state = useProposal()
    await state.generate(file)
    const firstKey = getIdempotencyKey()

    expect(state.status.value).toBe('error')
    expect(state.proposals.value).toEqual([])

    const retryRequest = state.retry(file)
    expect(state.status.value).toBe('pending')
    expect(state.error.value).toBeNull()
    expect(state.proposals.value).toEqual([])

    await retryRequest

    expect(state.status.value).toBe('success')
    expect(getIdempotencyKey()).not.toBe(firstKey)
  })
})
