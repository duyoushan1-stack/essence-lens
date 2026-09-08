import { getProposalService } from '../utils/providers/factory'
import type { ProposalService, ProposalServiceResult } from '../services/proposal.service'

const getRequestId = () => crypto.randomUUID()

interface ProposalHandlerOptions {
  isDevelopment?: boolean
}

const toErrorStatusCode = (code: ProposalApiErrorResponse['code']) => {
  if (code === 'provider-unavailable') {
    return 503
  }

  if (code === 'provider-invalid-request') {
    return 422
  }

  if (
    code === 'provider-authentication-failed' ||
    code === 'provider-request-failed' ||
    code === 'malformed-provider-response'
  ) {
    return 502
  }

  return 500
}

export const toApiErrorResponse = (
  requestId: string,
  result: Extract<ProposalServiceResult, { status: 'error' }>,
  includeDebug = import.meta.dev
): ProposalApiErrorResponse => ({
  status: 'error',
  requestId,
  code: result.code,
  ...(includeDebug && result.debug ? { debug: result.debug } : {})
})

const toResponse = (
  requestId: string,
  result: ProposalServiceResult,
  isDevelopment = import.meta.dev
) => {
  if (result.status === 'success') {
    const response: ProposalApiSuccessResponse = {
      status: 'success',
      requestId,
      proposals: result.proposals,
      ...(isDevelopment && result.debug ? { debug: result.debug } : {})
    }
    return response
  }

  if (result.status === 'rejected') {
    const response: ProposalApiRejectedResponse = {
      status: 'rejected',
      requestId,
      reasons: result.reasons,
      ...(isDevelopment && result.debug ? { debug: result.debug } : {})
    }
    throw createError({ statusCode: 422, data: response })
  }

  if (result.status === 'conflict') {
    throw createError({
      statusCode: 409,
      data: { status: 'error', requestId, code: 'idempotency-conflict' }
    })
  }

  const response = toApiErrorResponse(requestId, result, isDevelopment)

  if (isDevelopment && response.debug) {
    useNitroApp().captureError(new Error('Proposal provider error'), {
      tags: ['proposal-provider'],
      response
    })
  }

  throw createError({ statusCode: toErrorStatusCode(result.code), data: response })
}

export const createProposalHandler = (
  proposalService?: ProposalService,
  options: ProposalHandlerOptions = {}
) => {
  const isDevelopment = options.isDevelopment ?? import.meta.dev

  return defineEventHandler(async (event) => {
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
    const debugRequested = isDevelopment && getHeader(event, 'X-Proposal-Debug') === '1'

    if (!filePart || !idempotencyKey) {
      throw createError({
        statusCode: 400,
        data: { status: 'error', requestId, code: 'request-failed' }
      })
    }

    let result: ProposalServiceResult

    try {
      result = await (proposalService ?? getProposalService()).generate({
        file: {
          bytes: filePart.data,
          mimeType: filePart.type ?? '',
          filename: filePart.filename ?? 'upload'
        },
        idempotencyKey,
        ...(debugRequested ? { debug: true } : {})
      })
    } catch {
      // 將非預期的 service 例外收斂在公開 API error contract 內。
      return toResponse(requestId, { status: 'error', code: 'server-failure' }, isDevelopment)
    }

    return toResponse(requestId, result, isDevelopment)
  })
}

export default createProposalHandler()
