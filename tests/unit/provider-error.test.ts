import { describe, expect, it } from 'vitest'
import { normalizeProviderError } from '../../server/utils/provider-error'

describe('normalizeProviderError', () => {
  it('classifies provider HTTP 503 responses as retryable', () => {
    expect(normalizeProviderError({ status: 503 })).toEqual({
      kind: 'transient',
      retryable: true
    })
  })

  it('classifies network timeout codes as retryable', () => {
    expect(normalizeProviderError({ cause: { code: 'ETIMEDOUT' } })).toEqual({
      kind: 'transient',
      retryable: true
    })
  })

  it('does not retry invalid provider responses', () => {
    expect(normalizeProviderError({ code: 'schema-validation-failed' })).toEqual({
      kind: 'invalid-response',
      retryable: false
    })
  })

  it('does not retry unknown failures by default', () => {
    expect(normalizeProviderError(new Error('unexpected failure'))).toEqual({
      kind: 'unknown',
      retryable: false
    })
  })
})
