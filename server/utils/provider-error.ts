/** Provider 例外經過正規化後的分類，供 retry policy 判斷是否可重試。 */
export type ProviderErrorKind = 'transient' | 'invalid-response' | 'unknown'

/** 不暴露 Provider 原始錯誤內容的最小錯誤資訊。 */
export interface NormalizedProviderError {
  kind: ProviderErrorKind
  retryable: boolean
}

interface UnknownRecord {
  [key: string]: unknown
}

const TRANSIENT_CODES = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENETUNREACH',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET'
])

const INVALID_RESPONSE_CODES = new Set([
  'invalid-response',
  'malformed-response',
  'schema-validation-failed'
])

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const getString = (value: unknown): string | null =>
  typeof value === 'string' ? value.toUpperCase() : null

const getNumber = (value: unknown): number | null =>
  typeof value === 'number' ? value : null

/** 將不同 SDK、HTTP client 或網路錯誤轉成一致的重試判斷結果。 */
export const normalizeProviderError = (error: unknown): NormalizedProviderError => {
  if (!isRecord(error)) {
    return { kind: 'unknown', retryable: false }
  }

  const cause = isRecord(error.cause) ? error.cause : null
  const response = isRecord(error.response) ? error.response : null
  const code = getString(error.code) ?? getString(cause?.code)
  const status =
    getNumber(error.statusCode) ??
    getNumber(error.status) ??
    getNumber(response?.status) ??
    getNumber(cause?.statusCode)

  if (code && INVALID_RESPONSE_CODES.has(code.toLowerCase())) {
    return { kind: 'invalid-response', retryable: false }
  }

  if (
    (status !== null && (status === 408 || status === 425 || status === 429 || status >= 500)) ||
    (code !== null && TRANSIENT_CODES.has(code))
  ) {
    return { kind: 'transient', retryable: true }
  }

  return { kind: 'unknown', retryable: false }
}
