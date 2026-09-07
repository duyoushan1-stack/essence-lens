/** Provider 例外經過正規化後的分類，供 retry policy 與 API error mapping 使用。 */
export type ProviderErrorKind =
  | 'configuration'
  | 'authentication'
  | 'invalid-request'
  | 'transient'
  | 'invalid-response'
  | 'unknown'

/** 不暴露 Provider 原始錯誤內容的最小錯誤資訊。 */
export interface NormalizedProviderError {
  kind: ProviderErrorKind
  retryable: boolean
  provider?: string
  statusCode?: number
  providerCode?: string
}

interface UnknownRecord {
  [key: string]: unknown
}

/** 網路或上游暫時性錯誤，可由 retry policy 重新嘗試。 */
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

/** Provider 回應格式或 schema 無效，不應重試。 */
const INVALID_RESPONSE_CODES = new Set([
  'invalid-response',
  'malformed-response',
  'schema-validation-failed'
])

/** Server 設定缺失或無效，應優先修正 runtime config。 */
const CONFIGURATION_CODES = new Set(['missing-configuration', 'invalid-configuration'])

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const getString = (value: unknown): string | null =>
  typeof value === 'string' ? value.toUpperCase() : null

const getRawString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

const getNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return null
  }

  const number = Number(value)

  return Number.isInteger(number) ? number : null
}

const getProviderCode = (error: UnknownRecord): string | null => {
  const directCode = getRawString(error.providerCode)

  if (directCode) {
    return directCode
  }

  const body = isRecord(error.body) ? error.body : null
  const providerError = body && isRecord(body.error) ? body.error : null

  return getRawString(providerError?.code) ?? getRawString(error.code)
}

/** 將不同 SDK、HTTP client 或網路錯誤轉成一致的重試判斷結果。 */
export const normalizeProviderError = (
  error: unknown,
  fallbackProvider?: string
): NormalizedProviderError => {
  if (!isRecord(error)) {
    return {
      kind: 'unknown',
      retryable: false,
      ...(fallbackProvider ? { provider: fallbackProvider } : {})
    }
  }

  const cause = isRecord(error.cause) ? error.cause : null
  const response = isRecord(error.response) ? error.response : null
  const code = getString(error.code) ?? getString(cause?.code)
  const status =
    getNumber(error.statusCode) ??
    getNumber(error.status) ??
    getNumber(response?.status) ??
    getNumber(cause?.statusCode)
  const provider = getRawString(error.provider) ?? fallbackProvider ?? undefined
  const providerCode = getProviderCode(error) ?? undefined
  const classificationCode = code ?? getString(providerCode)
  const details = {
    ...(provider ? { provider } : {}),
    ...(status !== null ? { statusCode: status } : {}),
    ...(providerCode ? { providerCode } : {})
  }

  if (classificationCode && INVALID_RESPONSE_CODES.has(classificationCode.toLowerCase())) {
    return { kind: 'invalid-response', retryable: false, ...details }
  }

  if (classificationCode && CONFIGURATION_CODES.has(classificationCode.toLowerCase())) {
    return { kind: 'configuration', retryable: false, ...details }
  }

  if (status === 401 || status === 403) {
    return { kind: 'authentication', retryable: false, ...details }
  }

  if (status === 400) {
    return { kind: 'invalid-request', retryable: false, ...details }
  }

  if (
    (status !== null && (status === 408 || status === 425 || status === 429 || status >= 500)) ||
    (code !== null && TRANSIENT_CODES.has(code))
  ) {
    return { kind: 'transient', retryable: true, ...details }
  }

  return { kind: 'unknown', retryable: false, ...details }
}
