import { getProposalService } from '../utils/providers/factory'
import type { ProposalService, ProposalServiceResult } from '../services/proposal.service'

const getRequestId = () => crypto.randomUUID()

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
  includeDiagnostics = import.meta.dev
): ProposalApiErrorResponse => ({
  status: 'error',
  requestId,
  code: result.code,
  ...(includeDiagnostics && result.diagnostics ? { diagnostics: result.diagnostics } : {})
})

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

  const response = toApiErrorResponse(requestId, result)

  if (import.meta.dev && response.diagnostics) {
    console.error('[proposal provider error]', response)
  }

  throw createError({ statusCode: toErrorStatusCode(result.code), data: response })
}

export const createProposalHandler = (proposalService?: ProposalService) =>
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
      result = await (proposalService ?? getProposalService()).generate({
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
