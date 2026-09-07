import { describe, expect, it, vi } from 'vitest'
import type {
  ContentSafetyAssessment,
  ImageSemanticAnalysis
} from '../../shared/types/image-feasibility'
import type { ProviderImageInput } from '../../server/providers/provider.types'
import { evaluateImageFeasibilityForFile } from '../../server/services/image-feasibility.service'

const input: ProviderImageInput = {
  bytes: new Uint8Array([1, 2, 3]),
  mimeType: 'image/jpeg',
  filename: 'sample.jpg'
}

const safeContentSafety: ContentSafetyAssessment = {
  provider: 'azure-content-safety',
  categories: {
    hate: 0,
    'self-harm': 0,
    sexual: 0,
    violence: 0
  }
}

const clearSemanticAnalysis: ImageSemanticAnalysis = {
  schemaVersion: 'image-semantic-analysis-v1',
  scene: { category: 'outdoor', recognizable: true },
  subjects: {
    peopleCount: 0,
    isSelfie: 'absent',
    hasProductFocus: 'absent',
    hasPetCloseup: 'absent',
    isMemeLike: 'absent'
  },
  quality: {
    blur: 'none',
    isSolidColor: 'absent',
    informationSufficient: true
  },
  safety: {
    nudity: 'absent',
    sexual: 'absent',
    violence: 'absent',
    gore: 'absent'
  },
  visualMood: ['calm'],
  usefulObjects: ['trees']
}

describe('evaluateImageFeasibilityForFile', () => {
  it('accepts safe mock Provider data', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue(safeContentSafety)
    const analyzeSemantics = vi.fn().mockResolvedValue(clearSemanticAnalysis)

    const result = await evaluateImageFeasibilityForFile(input, {
      analyzeSafety,
      analyzeSemantics
    })

    expect(result).toEqual({
      status: 'accepted',
      context: {
        scene: clearSemanticAnalysis.scene,
        subjects: clearSemanticAnalysis.subjects,
        visualMood: clearSemanticAnalysis.visualMood,
        usefulObjects: clearSemanticAnalysis.usefulObjects
      }
    })
    expect(analyzeSafety).toHaveBeenCalledOnce()
    expect(analyzeSemantics).toHaveBeenCalledOnce()
  })

  it('rejects Azure safety findings without calling Gemini', async () => {
    const analyzeSafety = vi.fn().mockResolvedValue({
      ...safeContentSafety,
      categories: { ...safeContentSafety.categories, sexual: 2 }
    })
    const analyzeSemantics = vi.fn().mockResolvedValue(clearSemanticAnalysis)

    const result = await evaluateImageFeasibilityForFile(input, {
      analyzeSafety,
      analyzeSemantics
    })

    expect(result).toEqual({
      status: 'rejected',
      reasons: [{ category: 'safety', code: 'sexual' }]
    })
    expect(analyzeSemantics).not.toHaveBeenCalled()
  })

  it('maps a Provider failure to a retryable error', async () => {
    const analyzeSafety = vi.fn().mockRejectedValue(new Error('provider unavailable'))
    const analyzeSemantics = vi.fn()

    const result = await evaluateImageFeasibilityForFile(input, {
      analyzeSafety,
      analyzeSemantics
    })

    expect(result).toEqual({
      status: 'error',
      code: 'provider-request-failed',
      diagnostics: { provider: 'azure-content-safety' }
    })
    expect(analyzeSemantics).not.toHaveBeenCalled()
  })

  it('keeps authentication diagnostics in development-safe error data', async () => {
    const analyzeSafety = vi.fn().mockRejectedValue({
      status: 401,
      provider: 'azure-content-safety',
      providerCode: 'InvalidApiKey'
    })
    const analyzeSemantics = vi.fn()

    const result = await evaluateImageFeasibilityForFile(input, {
      analyzeSafety,
      analyzeSemantics
    })

    expect(result).toEqual({
      status: 'error',
      code: 'provider-authentication-failed',
      diagnostics: {
        provider: 'azure-content-safety',
        statusCode: 401,
        providerCode: 'InvalidApiKey'
      }
    })
    expect(analyzeSemantics).not.toHaveBeenCalled()
  })

  it('maps an invalid Provider response to a malformed response error', async () => {
    const analyzeSafety = vi.fn().mockRejectedValue({ code: 'malformed-response' })
    const analyzeSemantics = vi.fn()

    const result = await evaluateImageFeasibilityForFile(input, {
      analyzeSafety,
      analyzeSemantics
    })

    expect(result).toEqual({
      status: 'error',
      code: 'malformed-provider-response',
      diagnostics: {
        provider: 'azure-content-safety',
        providerCode: 'malformed-response'
      }
    })
    expect(analyzeSemantics).not.toHaveBeenCalled()
  })

  it('rejects invalid server input before calling Providers', async () => {
    const analyzeSafety = vi.fn()
    const analyzeSemantics = vi.fn()

    const result = await evaluateImageFeasibilityForFile(
      { ...input, bytes: new Uint8Array(), mimeType: 'application/pdf' },
      { analyzeSafety, analyzeSemantics }
    )

    expect(result).toEqual({
      status: 'rejected',
      reasons: [{ category: 'technical', code: 'empty-file' }]
    })
    expect(analyzeSafety).not.toHaveBeenCalled()
    expect(analyzeSemantics).not.toHaveBeenCalled()
  })
})
