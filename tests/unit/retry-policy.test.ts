import { describe, expect, it, vi } from 'vitest'
import { withRetry } from '../../server/utils/retry-policy'

describe('withRetry', () => {
  it('retries transient failures with bounded exponential delays', async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValue('success')
    const delays: number[] = []

    const result = await withRetry(operation, {
      baseDelayMs: 10,
      maxDelayMs: 15,
      sleep: async (delayMs) => {
        delays.push(delayMs)
      }
    })

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(3)
    expect(delays).toEqual([10, 15])
  })

  it('does not retry non-transient failures', async () => {
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue({ status: 400 })

    await expect(withRetry(operation, { sleep: async () => undefined })).rejects.toMatchObject({
      status: 400
    })
    expect(operation).toHaveBeenCalledOnce()
  })

  it('throws after the maximum number of attempts', async () => {
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue({ status: 503 })

    await expect(
      withRetry(operation, {
        maxAttempts: 2,
        sleep: async () => undefined
      })
    ).rejects.toMatchObject({ status: 503 })
    expect(operation).toHaveBeenCalledTimes(2)
  })
})
