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

const getTextPart = (part: { data: Uint8Array }): string => new TextDecoder().decode(part.data)

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
    const parts = await readMultipartFormData(event)
    const filePart = parts?.find((part) => part.name === 'file')
    const keyPart = parts?.find((part) => part.name === 'idempotencyKey')

    if (!filePart || !keyPart) {
      throw createError({
        statusCode: 400,
        data: { status: 'error', requestId, code: 'request-failed' }
      })
    }

    const idempotencyKey = getTextPart(keyPart)

    if (!idempotencyKey) {
      throw createError({
        statusCode: 400,
        data: { status: 'error', requestId, code: 'request-failed' }
      })
    }

    const result = await proposalService.generate({
      file: {
        bytes: filePart.data,
        mimeType: filePart.type ?? '',
        filename: filePart.filename ?? 'upload'
      },
      idempotencyKey
    })

    return toResponse(requestId, result)
  })

export default createProposalHandler()
