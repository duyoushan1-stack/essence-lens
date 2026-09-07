import { describe, expect, it } from 'vitest'
import { normalizeProviderError } from '../../server/utils/providers/error'

describe('normalizeProviderError', () => {
  it('classifies provider HTTP 503 responses as retryable', () => {
    expect(normalizeProviderError({ provider: 'azure-content-safety', status: 503 })).toEqual({
      kind: 'transient',
      retryable: true,
      provider: 'azure-content-safety',
      statusCode: 503
    })
  })

  it('classifies provider authentication failures without retrying', () => {
    expect(
      normalizeProviderError({
        provider: 'azure-content-safety',
        status: 401,
        providerCode: 'InvalidApiKey'
      })
    ).toEqual({
      kind: 'authentication',
      retryable: false,
      provider: 'azure-content-safety',
      statusCode: 401,
      providerCode: 'InvalidApiKey'
    })
  })

  it('classifies provider request validation failures without retrying', () => {
    expect(normalizeProviderError({ status: 400, providerCode: 'InvalidImage' })).toEqual({
      kind: 'invalid-request',
      retryable: false,
      statusCode: 400,
      providerCode: 'InvalidImage'
    })
  })

  it('classifies missing provider configuration separately', () => {
    expect(
      normalizeProviderError({
        provider: 'azure-content-safety',
        providerCode: 'missing-configuration'
      })
    ).toEqual({
      kind: 'configuration',
      retryable: false,
      provider: 'azure-content-safety',
      providerCode: 'missing-configuration'
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
      retryable: false,
      providerCode: 'schema-validation-failed'
    })
  })

  it('does not retry unknown failures by default', () => {
    expect(normalizeProviderError(new Error('unexpected failure'))).toEqual({
      kind: 'unknown',
      retryable: false
    })
  })
})
