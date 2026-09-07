import { normalizeProviderError } from './providers/error'

/** Provider 呼叫的重試限制與延遲設定；可注入 sleep 以便測試。 */
export interface RetryPolicyOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  sleep?: (delayMs: number) => Promise<void>
  shouldRetry?: (error: unknown) => boolean
}

const sleep = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs)
  })

/** 只重試被判定為暫時性的錯誤，並在達到上限後重新拋出原始錯誤。 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryPolicyOptions = {}
): Promise<T> => {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3))
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250)
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 1000)
  const wait = options.sleep ?? sleep
  const shouldRetry =
    options.shouldRetry ?? ((error: unknown) => normalizeProviderError(error).retryable)

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation()
    } catch (error: unknown) {
      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error
      }

      const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))
      await wait(delayMs)
    }
  }

  throw new Error('Retry policy exhausted without an operation result')
}
