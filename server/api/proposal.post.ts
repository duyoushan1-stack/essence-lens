import { analyzeImageSafety } from '../providers/azure-content-safety'
import { analyzeImageSemantics, generateProposal } from '../providers/gemini'
import { createMockProposalProviders } from '../providers/mock-providers'
import {
  createProposalService,
  type ProposalService,
  type ProposalServiceResult
} from '../services/proposal.service'

const defaultProposalService = createProposalService(
  import.meta.dev
    ? createMockProposalProviders()
    : {
        analyzeSafety: analyzeImageSafety,
        analyzeSemantics: analyzeImageSemantics,
        generateProposal
      }
)

const getRequestId = () => crypto.randomUUID()

const toErrorStatusCode = (code: ProposalApiErrorResponse['code']) =>
  code === 'provider-unavailable' ? 503 : 500

const toResponse = (requestId: string, result: ProposalServiceResult) => {
  if (result.status === 'success') {
    const response: ProposalApiSuccessResponse = {
      status: 'success',
      requestId,
      proposals: result.proposals
    }
    return response
  }

  if (result.status === 'rejected') {
    const response: ProposalApiRejectedResponse = {
      status: 'rejected',
      requestId,
      reasons: result.reasons
    }
    throw createError({ statusCode: 422, data: response })
  }

  if (result.status === 'conflict') {
    throw createError({
      statusCode: 409,
      data: { status: 'error', requestId, code: 'idempotency-conflict' }
    })
  }

  const response: ProposalApiErrorResponse = {
    status: 'error',
    requestId,
    code: result.code
  }
  throw createError({ statusCode: toErrorStatusCode(result.code), data: response })
}

export const createProposalHandler = (proposalService: ProposalService = defaultProposalService) =>
  defineEventHandler(async (event) => {
    const requestId = getRequestId()
    let parts: Awaited<ReturnType<typeof readMultipartFormData>>

    try {
      parts = await readMultipartFormData(event)
    } catch {
      throw createError({
        statusCode: 400,
        data: { status: 'error', requestId, code: 'request-failed' }
      })
    }

    const filePart = parts?.find((part) => part.name === 'file')
    const idempotencyKey = getHeader(event, 'Idempotency-Key')?.trim()

    if (!filePart || !idempotencyKey) {
      throw createError({
        statusCode: 400,
        data: { status: 'error', requestId, code: 'request-failed' }
      })
    }

    let result: ProposalServiceResult

    try {
      result = await proposalService.generate({
        file: {
          bytes: filePart.data,
          mimeType: filePart.type ?? '',
          filename: filePart.filename ?? 'upload'
        },
        idempotencyKey
      })
    } catch {
      // 將非預期的 service 例外收斂在公開 API error contract 內。
      return toResponse(requestId, { status: 'error', code: 'server-failure' })
    }

    return toResponse(requestId, result)
  })

export default createProposalHandler()
