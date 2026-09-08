import type {
  ProposalApiErrorResponse,
  ProposalApiRejectedResponse,
  ProposalApiSuccessResponse
} from '../../shared/types/proposal-api'
import type { Proposal } from '../../shared/types/proposal'
import type {
  ProposalPipelineInput,
  ProposalService,
  ProposalServiceResult
} from '../../server/services/proposal.service'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@azure-rest/ai-content-safety', () => ({
  default: vi.fn(),
  isUnexpected: vi.fn()
}))

vi.mock('@azure/core-auth', () => ({
  AzureKeyCredential: class MockAzureKeyCredential {
    constructor(readonly key: string) {}
  }
}))

interface MultipartPart {
  name: string
  data: Uint8Array
  filename?: string
  type?: string
}

interface RouteError extends Error {
  statusCode: number
  data: unknown
}

type ProposalHandler = typeof import('../../server/api/proposal.post').default
type ProposalHandlerFactory = typeof import('../../server/api/proposal.post').createProposalHandler
type ApiErrorResponseFactory = typeof import('../../server/api/proposal.post').toApiErrorResponse

let createProposalHandler: ProposalHandlerFactory
let toApiErrorResponse: ApiErrorResponseFactory
let currentParts: MultipartPart[] | undefined
let currentIdempotencyKey: string | undefined
let currentDebugHeader: string | undefined
let currentRequestId = 'request-123'

const filePart: MultipartPart = {
  name: 'file',
  data: new Uint8Array([1, 2, 3]),
  filename: 'sample.jpg',
  type: 'image/jpeg'
}

const createService = (result: ProposalServiceResult): ProposalService => ({
  generate: vi
    .fn<(input: ProposalPipelineInput) => Promise<ProposalServiceResult>>()
    .mockResolvedValue(result)
})

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readMultipartFormData', async () => currentParts)
  vi.stubGlobal('getHeader', (_event: unknown, name: string) => {
    if (name === 'Idempotency-Key') {
      return currentIdempotencyKey
    }

    if (name === 'X-Proposal-Debug') {
      return currentDebugHeader
    }

    return undefined
  })
  vi.stubGlobal(
    'defineCachedFunction',
    <TInput extends { idempotencyKey: string }, TResult>(
      fn: (input: TInput) => Promise<TResult>,
      options: { getKey: (input: TInput) => string | Promise<string> }
    ) => {
      const cache = new Map<string, TResult>()

      return async (input: TInput): Promise<TResult> => {
        const key = await options.getKey(input)
        const existing = cache.get(key)

        if (existing) {
          return existing
        }

        const result = await fn(input)
        cache.set(key, result)
        return result
      }
    }
  )
  vi.stubGlobal('createError', (input: { statusCode: number; data: unknown }) => {
    const error = new Error('route error') as RouteError
    error.statusCode = input.statusCode
    error.data = input.data
    return error
  })
  vi.stubGlobal('crypto', { randomUUID: () => currentRequestId })

  const apiModule = await import('../../server/api/proposal.post')
  createProposalHandler = apiModule.createProposalHandler
  toApiErrorResponse = apiModule.toApiErrorResponse
})

beforeEach(() => {
  currentParts = [filePart]
  currentIdempotencyKey = 'key-1'
  currentDebugHeader = undefined
  currentRequestId = 'request-123'
})

describe('POST /api/proposal', () => {
  it('models success and rejected API outcomes with request ids', () => {
    const success: ProposalApiSuccessResponse = {
      status: 'success',
      requestId: 'request-123',
      proposals: [
        {
          title: '午後散步與咖啡',
          description: '到附近街區散步，再找一間安靜的咖啡店休息。'
        }
      ]
    }
    const rejected: ProposalApiRejectedResponse = {
      status: 'rejected',
      requestId: 'request-123',
      reasons: [{ category: 'safety', code: 'sexual' }]
    }

    expect(success.status).toBe('success')
    expect(rejected.reasons[0]).toEqual({ category: 'safety', code: 'sexual' })
  })

  it('returns a success response from the proposal service', async () => {
    const proposals: Proposal[] = [
      {
        title: '午後散步與咖啡',
        description: '到附近街區散步，再找一間安靜的咖啡店休息。'
      }
    ]
    const service = createService({ status: 'success', proposals })
    const handler = createProposalHandler(service)

    const response = await handler({} as Parameters<ProposalHandler>[0])

    expect(response).toEqual<ProposalApiSuccessResponse>({
      status: 'success',
      requestId: 'request-123',
      proposals
    })
    expect(service.generate).toHaveBeenCalledWith({
      file: {
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: 'image/jpeg',
        filename: 'sample.jpg'
      },
      idempotencyKey: 'key-1'
    })
  })

  it('returns 400 when the multipart request is missing a file', async () => {
    currentParts = []
    const handler = createProposalHandler(createService({ status: 'success', proposals: [] }))

    await expect(handler({} as Parameters<ProposalHandler>[0])).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it('returns 400 when the idempotency key header is missing', async () => {
    currentIdempotencyKey = undefined
    const handler = createProposalHandler(createService({ status: 'success', proposals: [] }))

    await expect(handler({} as Parameters<ProposalHandler>[0])).rejects.toMatchObject({
      statusCode: 400,
      data: { status: 'error', requestId: 'request-123', code: 'request-failed' }
    })
  })

  it('returns 400 when multipart parsing fails', async () => {
    currentParts = undefined
    vi.stubGlobal('readMultipartFormData', async () => {
      throw new Error('malformed multipart')
    })
    const handler = createProposalHandler(createService({ status: 'success', proposals: [] }))

    await expect(handler({} as Parameters<ProposalHandler>[0])).rejects.toMatchObject({
      statusCode: 400,
      data: { status: 'error', requestId: 'request-123', code: 'request-failed' }
    })

    vi.stubGlobal('readMultipartFormData', async () => currentParts)
  })

  it('returns 422 with explicit rejection reasons', async () => {
    const rejected: ProposalApiRejectedResponse = {
      status: 'rejected',
      requestId: 'request-123',
      reasons: [{ category: 'safety', code: 'sexual' }]
    }
    const handler = createProposalHandler(
      createService({ status: 'rejected', reasons: rejected.reasons })
    )

    await expect(handler({} as Parameters<ProposalHandler>[0])).rejects.toMatchObject({
      statusCode: 422,
      data: rejected
    })
  })

  it('returns 409 when the idempotency key payload conflicts', async () => {
    const handler = createProposalHandler(createService({ status: 'conflict' }))

    await expect(handler({} as Parameters<ProposalHandler>[0])).rejects.toMatchObject({
      statusCode: 409
    })
  })

  it('returns a stable 5xx error response', async () => {
    const error: ProposalApiErrorResponse = {
      status: 'error',
      requestId: 'request-123',
      code: 'provider-unavailable'
    }
    const handler = createProposalHandler(
      createService({ status: 'error', code: 'provider-unavailable' })
    )

    await expect(handler({} as Parameters<ProposalHandler>[0])).rejects.toMatchObject({
      statusCode: 503,
      data: error
    })
  })

  it('includes safe provider debug data only when explicitly enabled', () => {
    const result = {
      status: 'error' as const,
      code: 'provider-authentication-failed' as const,
      debug: {
        provider: {
          provider: 'azure-content-safety',
          statusCode: 401,
          providerCode: 'InvalidApiKey'
        }
      }
    }

    expect(toApiErrorResponse('request-123', result, true)).toEqual({
      status: 'error',
      requestId: 'request-123',
      code: 'provider-authentication-failed',
      debug: result.debug
    })
    expect(toApiErrorResponse('request-123', result, false)).toEqual({
      status: 'error',
      requestId: 'request-123',
      code: 'provider-authentication-failed'
    })
  })

  it('passes the explicit debug opt-in and returns semantic analysis in development', async () => {
    const debug = {
      semanticAnalysis: {
        schemaVersion: 'image-semantic-analysis-v1' as const,
        scene: { category: 'outdoor' as const, recognizable: true },
        subjects: {
          peopleCount: 0,
          isSelfie: 'absent' as const,
          hasProductFocus: 'absent' as const,
          hasPetCloseup: 'absent' as const,
          isMemeLike: 'absent' as const
        },
        quality: { blur: 'none' as const, isSolidColor: 'absent' as const, informationSufficient: true },
        safety: {
          nudity: 'absent' as const,
          sexual: 'absent' as const,
          violence: 'absent' as const,
          gore: 'absent' as const
        },
        visualMood: ['calm'],
        usefulObjects: ['trees']
      }
    }
    const proposals: Proposal[] = [{ title: '午後散步', description: '到附近走走。' }]
    const service = createService({ status: 'success', proposals, debug })
    const handler = createProposalHandler(service, { isDevelopment: true })
    currentDebugHeader = '1'

    const response = await handler({} as Parameters<ProposalHandler>[0])

    expect(response).toEqual({ status: 'success', requestId: 'request-123', proposals, debug })
    expect(service.generate).toHaveBeenCalledWith({
      file: {
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: 'image/jpeg',
        filename: 'sample.jpg'
      },
      idempotencyKey: 'key-1',
      debug: true
    })
  })

  it('normalizes an unexpected service failure without exposing its message', async () => {
    const service: ProposalService = {
      generate: vi.fn().mockRejectedValue(new Error('provider secret'))
    }
    const handler = createProposalHandler(service)

    await expect(handler({} as Parameters<ProposalHandler>[0])).rejects.toMatchObject({
      statusCode: 500,
      data: {
        status: 'error',
        requestId: 'request-123',
        code: 'server-failure'
      }
    })
  })
})
