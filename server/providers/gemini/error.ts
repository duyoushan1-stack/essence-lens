import type {
  ProposalProviderStage,
  ProposalValidationIssue
} from '../../../shared/types/proposal'

interface UnknownRecord {
  [key: string]: unknown
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const getNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return undefined
  }

  const number = Number(value)

  return Number.isInteger(number) ? number : undefined
}

const parseBody = (value: unknown): UnknownRecord | undefined => {
  if (isRecord(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

const unwrapErrorPayload = (value: unknown): UnknownRecord | undefined => {
  const record = parseBody(value)

  if (!record) {
    return undefined
  }

  if (isRecord(record.error)) {
    return isRecord(record.error.error) ? record.error.error : record.error
  }

  return record
}

const getErrorPayload = (error: UnknownRecord): UnknownRecord | undefined =>
  unwrapErrorPayload(error.error) ??
  unwrapErrorPayload(error.body) ??
  unwrapErrorPayload(error.message)

const getStatusCode = (error: UnknownRecord): number | undefined => {
  const response = isRecord(error.response) ? error.response : undefined
  const payload = getErrorPayload(error)
  const candidates = [error.statusCode, error.status, response?.status, payload?.code]

  for (const candidate of candidates) {
    const statusCode = getNumber(candidate)

    if (statusCode !== undefined) {
      return statusCode
    }
  }

  return undefined
}

const getProviderCode = (error: UnknownRecord): string => {
  const payload = getErrorPayload(error)
  const candidates = [error.providerCode, payload?.status, payload?.code, error.code]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate
    }
  }

  return 'request-failed'
}

export class GeminiRequestError extends Error {
  readonly provider = 'gemini'

  constructor(
    readonly statusCode: number | undefined,
    readonly providerCode: string,
    /** 保留原始 SDK error，僅供 server-side logging / 後續診斷使用。 */
    readonly sdkResponse: unknown
  ) {
    super('Gemini request failed')
    this.name = 'GeminiRequestError'
  }
}

export const toGeminiRequestError = (error: unknown): GeminiRequestError => {
  const record = isRecord(error) ? error : {}

  return new GeminiRequestError(getStatusCode(record), getProviderCode(record), error)
}

export const createGeminiProviderError = (
  code: string,
  diagnostics: {
    stage?: ProposalProviderStage
    validationIssues?: ReadonlyArray<ProposalValidationIssue>
  } = {}
): never => {
  throw { provider: 'gemini', code, ...diagnostics }
}
